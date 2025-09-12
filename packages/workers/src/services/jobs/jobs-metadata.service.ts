import { Injectable, Optional } from '@nestjs/common';
import { logger } from '@snakagent/core';
import { Postgres } from '@snakagent/database';
import { JobStatus, JobType } from '../../types/index.js';
import {
  JobMetadata,
  CreateJobMetadataData,
  UpdateJobMetadataData,
  JobMetadataFilters,
  JobRetrievalResult,
  ResultRetrievalOptions,
  ResultRegenerationOptions,
  ResultSource,
  ResultStatus,
} from '../../types/jobs.js';
import { RedisCacheService } from '../cache/redis-cache.service.js';
import { QueueManager } from '../../queues/queue-manager.js';

interface MutexEntry {
  promise: Promise<void>;
  resolve: () => void;
  waiting: number;
}

const userMutexes = new Map<string, MutexEntry>();

async function acquireUserMutex(userId: string): Promise<() => void> {
  let entry = userMutexes.get(userId);
  
  if (entry) {
    entry.waiting++;
    await entry.promise;
    // After waiting, check if we need to create a new mutex
    entry = userMutexes.get(userId);
    if (!entry) {
      // Create new mutex if the previous one was released
      let resolve: () => void;
      const promise = new Promise<void>((r) => { resolve = r; });
      entry = { promise, resolve: resolve!, waiting: 1 };
      userMutexes.set(userId, entry);
    }
  } else {
    let resolve: () => void;
    const promise = new Promise<void>((r) => { resolve = r; });
    entry = { promise, resolve: resolve!, waiting: 1 };
    userMutexes.set(userId, entry);
  }

  return () => {
    const currentEntry = userMutexes.get(userId);
    if (currentEntry) {
      currentEntry.waiting--;
      if (currentEntry.waiting <= 0) {
        userMutexes.delete(userId);
      }
      currentEntry.resolve();
    }
  };
}

@Injectable()
export class JobsMetadataService {
  constructor(
    @Optional() private readonly cacheService?: RedisCacheService,
    @Optional() private readonly queueManager?: QueueManager
  ) {}

  async createJobMetadata(data: CreateJobMetadataData): Promise<JobMetadata> {
    const jobId = data.jobId || data.payload?.jobId;

    try {
      if (!jobId) {
        throw new Error(
          'jobId is required (either in data.jobId or data.payload.jobId)'
        );
      }
      if (!data.agentId) {
        throw new Error('agentId is required');
      }
      if (!data.userId) {
        throw new Error('userId is required');
      }

      const query = `
        INSERT INTO jobs (
          job_id, agent_id, user_id, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        RETURNING *
      `;
      logger.debug(`Creating job metadata for jobId: ${jobId}`);

      const values = [
        jobId,
        data.agentId,
        data.userId,
        data.status || JobStatus.PENDING,
      ];

      const q = new Postgres.Query(query, values);
      const result = await Postgres.query(q);
      const job = result[0];

      logger.debug(`Created job metadata for job ${jobId}`);
      logger.debug(`Job metadata:`, job);

      return this.mapRowToJobMetadata(job);
    } catch (error) {
      logger.error(`Failed to create job metadata for ${jobId}:`, error);
      throw error;
    }
  }

  async updateJobMetadata(
    jobId: string,
    data: UpdateJobMetadataData
  ): Promise<JobMetadata | null> {
    try {
      const updateFields: Record<string, any> = {};
      
      if (data.status !== undefined) updateFields.status = data.status;
      if (data.error !== undefined) updateFields.error = data.error;
      if (data.startedAt !== undefined) updateFields.started_at = data.startedAt;
      if (data.completedAt !== undefined) updateFields.completed_at = data.completedAt;
      
      const fieldNames = Object.keys(updateFields);
      if (fieldNames.length === 0) {
        return await this.getJobMetadata(jobId);
      }
      
      const setClause = fieldNames.map((field, index) => `${field} = $${index + 1}`).join(', ');
      const values = [...Object.values(updateFields), jobId];
      
      const query = `
        UPDATE jobs 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = $${fieldNames.length + 1}
        RETURNING *
      `;

      const q = new Postgres.Query(query, values);
      const result = await Postgres.query(q);

      if (result.length === 0) {
        logger.warn(`Job metadata not found for job ${jobId}`);
        return null;
      }

      logger.debug(`Updated job metadata for job ${jobId}`);

      return this.mapRowToJobMetadata(result[0]);
    } catch (error) {
      logger.error(`Failed to update job metadata for ${jobId}:`, error);
      throw error;
    }
  }

  async getJobMetadata(jobId: string): Promise<JobMetadata | null> {
    try {
      const query = `
        SELECT * FROM jobs WHERE job_id = $1
      `;

      const q = new Postgres.Query(query, [jobId]);
      const result = await Postgres.query(q);

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToJobMetadata(result[0]);
    } catch (error) {
      logger.error(`Failed to get job metadata for ${jobId}:`, error);
      throw error;
    }
  }

  async getJobMetadataForUser(
    jobId: string,
    userId: string
  ): Promise<JobMetadata | null> {
    try {
      const query = `
        SELECT * FROM jobs WHERE job_id = $1 AND user_id = $2
      `;

      const q = new Postgres.Query(query, [jobId, userId]);
      const result = await Postgres.query(q);

      if (result.length === 0) {
        return null;
      }

      return this.mapRowToJobMetadata(result[0]);
    } catch (error) {
      logger.error(
        `Failed to get job metadata for ${jobId} and user ${userId}:`,
        error
      );
      throw error;
    }
  }

  async deleteJobMetadata(jobId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM jobs WHERE job_id = $1 RETURNING job_id
      `;

      const q = new Postgres.Query(query, [jobId]);
      const result = await Postgres.query(q);

      const deleted = result.length > 0;
      if (deleted) {
        logger.debug(`Deleted job metadata for job ${jobId}`);
      } else {
        logger.warn(`Job metadata not found for deletion: ${jobId}`);
      }

      return deleted;
    } catch (error) {
      logger.error(`Failed to delete job metadata for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Generate a unique job ID
   * @returns A unique job identifier
   */
  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `job_${timestamp}_${random}`;
  }

  private mapRowToJobMetadata(row: any): JobMetadata {
    return {
      id: row.id,
      jobId: row.job_id,
      type: row.type as JobType,
      status: row.status as JobStatus,
      agentId: row.agent_id,
      userId: row.user_id,
      payload: row.payload || {},
      result: row.result,
      error: row.error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      retryCount: row.retry_count || 0,
      maxRetries: row.max_retries || 3,
    };
  }

  async getJobRetrievalResult(
    jobId: string,
    userId: string,
    options: ResultRetrievalOptions = {}
  ): Promise<JobRetrievalResult> {
    const {
      allowRegeneration = true,
      maxRetries = 3,
      timeout = 30000,
      fallbackToBull = true,
    } = options;

    const startTime = Date.now();

    try {
      const cachedResult = await this.getFromCache(jobId, userId);
      if (cachedResult) {
        logger.debug(`Result retrieved from cache for job ${jobId}`);
        return {
          ...cachedResult,
          source: ResultSource.CACHE,
        };
      }

      const releaseMutex = await acquireUserMutex(userId);
      
      try {
        const cachedResult2 = await this.getFromCache(jobId, userId);
        if (cachedResult2) {
          logger.debug(`Result retrieved from cache (double-check) for job ${jobId}`);
          return {
            ...cachedResult2,
            source: ResultSource.CACHE,
          };
        }

        const dbResult = await this.getFromDatabase(jobId, userId);
        if (dbResult) {
          if (this.cacheService) {
            this.cacheService.setJobRetrievalResult(jobId, dbResult).catch(err => 
              logger.warn(`Failed to cache result for job ${jobId}:`, err)
            );
          }
          logger.debug(`Result retrieved from database for job ${jobId}`);
          return {
            ...dbResult,
            source: ResultSource.DATABASE,
          };
        }

        if (fallbackToBull) {
          const bullResult = await this.getFromBull(jobId, userId);
          if (bullResult) {
            if (this.cacheService) {
              this.cacheService.setJobRetrievalResult(jobId, bullResult).catch(err => 
                logger.warn(`Failed to cache Bull result for job ${jobId}:`, err)
              );
            }
            await this.updateDatabaseResult(jobId, userId, bullResult.data);
            logger.debug(`Result retrieved from Bull for job ${jobId}`);
            return {
              ...bullResult,
              source: ResultSource.BULL,
            };
          }
        }

        const jobMetadata = await this.getJobMetadataForUser(jobId, userId);
        if (jobMetadata) {
          if (
            jobMetadata.status === JobStatus.ACTIVE ||
            jobMetadata.status === JobStatus.PENDING
          ) {
            return {
              jobId,
              agentId: jobMetadata.agentId || '',
              userId: jobMetadata.userId,
              status: ResultStatus.PROCESSING,
              createdAt: jobMetadata.createdAt,
              source: ResultSource.DATABASE,
            };
          }
        }

        return {
          jobId,
          agentId: '',
          userId,
          status: ResultStatus.NOT_FOUND,
          createdAt: new Date(),
          source: ResultSource.DATABASE,
        };
      } finally {
        releaseMutex();
      }
    } catch (error) {
      logger.error(`Failed to retrieve result for job ${jobId}:`, error);

      if (allowRegeneration) {
        try {
          const regeneratedResult = await this.regenerateResult(jobId, userId, {
            forceRegeneration: true,
            timeout: Math.max(0, timeout - (Date.now() - startTime)),
          });

          if (regeneratedResult) {
            logger.info(`Result regenerated for job ${jobId}`);
            return {
              ...regeneratedResult,
              source: ResultSource.REGENERATED,
              regenerated: true,
            };
          }
        } catch (regenError) {
          logger.error(
            `Failed to regenerate result for job ${jobId}:`,
            regenError
          );
        }
      }

      return {
        jobId,
        agentId: '',
        userId,
        status: ResultStatus.FAILED,
        error: error instanceof Error ? error.message : String(error),
        createdAt: new Date(),
        source: ResultSource.DATABASE,
      };
    }
  }

  private async getFromCache(
    jobId: string,
    userId: string
  ): Promise<JobRetrievalResult | null> {
    if (!this.cacheService) return null;

    try {
      const cachedData = await this.cacheService.getJobRetrievalResult(jobId);
      if (!cachedData) return null;

      const jobMetadata = await this.getJobMetadataForUser(jobId, userId);

      return {
        jobId,
        agentId: jobMetadata?.agentId || '',
        userId,
        status: ResultStatus.COMPLETED,
        data: cachedData,
        createdAt: jobMetadata?.createdAt || new Date(),
        completedAt: jobMetadata?.completedAt,
        source: ResultSource.CACHE,
      };
    } catch (error) {
      logger.debug(`Cache retrieval failed for job ${jobId}:`, error);
      return null;
    }
  }

  private async getFromDatabase(
    jobId: string,
    userId: string
  ): Promise<JobRetrievalResult | null> {
    try {
      const jobMetadata = await this.getJobMetadataForUser(jobId, userId);
      if (!jobMetadata || jobMetadata.status !== JobStatus.COMPLETED) {
        return null;
      }

      if (!jobMetadata.result) {
        return null;
      }
      
      return {
        jobId,
        agentId: jobMetadata.agentId || '',
        userId: jobMetadata.userId,
        status: ResultStatus.COMPLETED,
        data: jobMetadata.result,
        createdAt: jobMetadata.createdAt,
        completedAt: jobMetadata.completedAt,
        source: ResultSource.DATABASE,
      };
    } catch (error) {
      logger.debug(`Database retrieval failed for job ${jobId}:`, error);
      return null;
    }
  }

  private async getFromBull(
    jobId: string,
    userId: string
  ): Promise<JobRetrievalResult | null> {
    if (!this.queueManager) {
      logger.debug(`QueueManager not available for Bull retrieval of job ${jobId}`);
      return null;
    }

    try {
      // Get all configured queues
      const config = this.queueManager.getConfig();
      const queueNames = Object.values(config.queues);

      // Search through all queues for the job
      for (const queueName of queueNames) {
        const queue = this.queueManager.getQueue(queueName);
        if (!queue) {
          logger.debug(`Queue ${queueName} not found`);
          continue;
        }

        try {
          const job = await queue.getJob(jobId);
          if (!job) {
            continue;
          }

          if (job.data?.userId !== userId) {
            logger.warn(
              `Job ownership mismatch for job ${jobId}: job.userId=${job.data?.userId}, requested.userId=${userId}`
            );
            continue;
          }

          const jobState = await job.getState();
          logger.debug(`Job ${jobId} found in queue ${queueName} with state: ${jobState}`);

          switch (jobState) {
            case 'completed':
              return {
                jobId,
                agentId: job.data?.agentId || '',
                userId: job.data?.userId || userId,
                status: ResultStatus.COMPLETED,
                data: job.returnvalue,
                createdAt: new Date(job.timestamp),
                completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
                source: ResultSource.BULL,
              };

            case 'failed':
              return {
                jobId,
                agentId: job.data?.agentId || '',
                userId: job.data?.userId || userId,
                status: ResultStatus.FAILED,
                error: job.failedReason,
                createdAt: new Date(job.timestamp),
                completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
                source: ResultSource.BULL,
              };

            case 'active':
            case 'waiting':
            case 'delayed':
              return {
                jobId,
                agentId: job.data?.agentId || '',
                userId: job.data?.userId || userId,
                status: ResultStatus.PROCESSING,
                createdAt: new Date(job.timestamp),
                source: ResultSource.BULL,
              };

            default:
              logger.warn(`Unknown job state ${jobState} for job ${jobId} in queue ${queueName}`);
              continue; // Try next queue
          }
        } catch (queueError) {
          logger.debug(`Error checking job ${jobId} in queue ${queueName}:`, queueError);
          continue; // Try next queue
        }
      }

      logger.debug(`Job ${jobId} not found in any Bull queue`);
      return null;
    } catch (error) {
      logger.debug(`Bull retrieval failed for job ${jobId}:`, error);
      return null;
    }
  }

  private async updateDatabaseResult(
    jobId: string,
    userId: string,
    data: any
  ): Promise<void> {
    try {
      const query = `
        UPDATE jobs 
        SET result = $1, status = $2, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE job_id = $3 AND user_id = $4
      `;
      
      const values = [
        JSON.stringify(data),
        JobStatus.COMPLETED,
        jobId,
        userId
      ];
      
      const q = new Postgres.Query(query, values);
      await Postgres.query(q);
      logger.debug(`Updated database result for job ${jobId}`);
    } catch (error) {
      logger.error(`Failed to update database result for job ${jobId}:`, error);
      // Don't throw - this is a best-effort operation
    }
  }

  async regenerateResult(
    jobId: string,
    userId: string,
    options: ResultRegenerationOptions = {}
  ): Promise<JobRetrievalResult | null> {
    const {
      forceRegeneration = false,
      preserveOriginalData = true,
      timeout = 30000,
    } = options;

    try {
      const jobMetadata = await this.getJobMetadataForUser(jobId, userId);
      if (!jobMetadata) {
        logger.warn(`Cannot regenerate result: job ${jobId} not found`);
        return null;
      }

      if (jobMetadata.status !== JobStatus.COMPLETED) {
        logger.warn(`Cannot regenerate result: job ${jobId} is not completed`);
        return null;
      }

      logger.info(`Result regeneration not implemented for job ${jobId}`);
      return null;
    } catch (error) {
      logger.error(`Failed to regenerate result for job ${jobId}:`, error);
      return null;
    }
  }

  async isResultAvailable(jobId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.getJobRetrievalResult(jobId, userId, {
        allowRegeneration: false,
        fallbackToBull: false,
      });

      return result.status === ResultStatus.COMPLETED;
    } catch (error) {
      logger.error(
        `Failed to check result availability for job ${jobId}:`,
        error
      );
      return false;
    }
  }

  async getResultStats(userId?: string): Promise<{
    total: number;
    cached: number;
    fromDatabase: number;
    fromBull: number;
    regenerated: number;
    failed: number;
  }> {
    try {
      return {
        total: 0,
        cached: 0,
        fromDatabase: 0,
        fromBull: 0,
        regenerated: 0,
        failed: 0,
      };
    } catch (error) {
      logger.error('Failed to get result stats:', error);
      return {
        total: 0,
        cached: 0,
        fromDatabase: 0,
        fromBull: 0,
        regenerated: 0,
        failed: 0,
      };
    }
  }

  async cleanupOldResults(daysOld: number = 7): Promise<number> {
    try {
      logger.debug(
        `Cache cleanup handled by Redis TTL for jobs older than ${daysOld} days`
      );
      return 0;
    } catch (error) {
      logger.error('Failed to cleanup old results:', error);
      return 0;
    }
  }
}
