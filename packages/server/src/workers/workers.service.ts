import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  WorkerManager,
  CacheService,
  JobsMetadataService,
} from '@snakagent/workers';
import { logger } from '@snakagent/core';
import { ConfigurationService } from '../../config/configuration.js';
import {
  JobNotFoundError,
  JobNotCompletedError,
  JobFailedError,
  UnknownJobStatusError,
} from '../common/errors/job-errors.js';

@Injectable()
export class WorkersService implements OnModuleInit, OnModuleDestroy {
  private workerManager: WorkerManager;
  private cacheService: CacheService;

  constructor(
    private readonly config: ConfigurationService,
    private readonly jobsMetadataService: JobsMetadataService
  ) {
    this.cacheService = new CacheService();
    this.workerManager = new WorkerManager(
      this.config.redis,
      this.cacheService
    );
  }

  async onModuleInit() {
    try {
      logger.info('Initializing workers service...');
      await this.workerManager.start();
      // Cache cleanup handled automatically
      logger.info('Workers service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize workers service:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      logger.info('Shutting down workers service...');
      await this.workerManager.stop();
      // Cache cleanup handled automatically
      logger.info('Workers service shutdown completed');
    } catch (error) {
      logger.error('Error during workers service shutdown:', error);
    }
  }

  /**
   * Process a file asynchronously using the file ingestion queue
   */
  async processFileAsync(
    agentId: string,
    userId: string,
    fileId: string,
    originalName: string,
    mimeType: string,
    buffer: Buffer,
    size: number
  ): Promise<string> {
    const fileIngestionQueue = this.workerManager
      .getJobProcessor()
      .getFileIngestionQueue();

    const job = await fileIngestionQueue.addFileIngestionJob({
      agentId,
      userId,
      fileId,
      originalName,
      mimeType,
      buffer,
      size,
    });

    const jobId = job.id?.toString();
    if (!jobId) {
      throw new Error('Failed to get job ID from queue');
    }
    logger.info(`File ingestion job added to queue with ID: ${jobId}`);

    try {
      await this.jobsMetadataService.createJobMetadata({
        type: 'file-ingestion' as any,
        agentId,
        userId,
        payload: { jobId, agentId, userId },
      });
      logger.debug(`Created job metadata for job ${jobId}`);
    } catch (error) {
      logger.error(`Failed to create job metadata for ${jobId}:`, error);
      // Don't let cache failures break the main operation
    }

    logger.info(`File processing queued with job ID: ${jobId}`);
    return jobId;
  }

  /**
   * Get job status by ID
   */
  async getJobStatus(jobId: string): Promise<{
    id: string;
    status: string;
    error?: string;
    createdAt?: Date;
    processedOn?: Date;
    finishedOn?: Date;
  } | null> {
    const fileIngestionQueue = this.workerManager
      .getJobProcessor()
      .getFileIngestionQueue();

    const job = await fileIngestionQueue.getQueue().getJob(jobId);

    if (!job) {
      return null;
    }

    return {
      id: job.id?.toString() || '',
      status: await job.getState(),
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  /**
   * Get job status by ID with user validation
   */
  async getJobStatusForUser(
    jobId: string,
    userId: string
  ): Promise<{
    id: string;
    status: string;
    error?: string;
    createdAt?: Date;
    processedOn?: Date;
    finishedOn?: Date;
  } | null> {
    logger.info(`Getting job status for ${jobId} (user: ${userId})`);

    // Check cache for job status
    const cachedStatus = await this.cacheService.getJobRetrievalResult(jobId);
    if (cachedStatus) {
      logger.debug(`Cache hit for job status ${jobId} (user: ${userId})`);
      return {
        id: cachedStatus.jobId,
        status: cachedStatus.status,
        error: cachedStatus.error,
        createdAt: cachedStatus.createdAt,
        finishedOn: cachedStatus.completedAt,
      };
    }

    try {
      const jobMetadata = await this.jobsMetadataService.getJobMetadataForUser(
        jobId,
        userId
      );
      if (jobMetadata) {
        const status = {
          id: jobMetadata.jobId,
          status: jobMetadata.status,
          error: jobMetadata.error,
          createdAt: jobMetadata.createdAt,
          processedOn: jobMetadata.startedAt,
          finishedOn: jobMetadata.completedAt,
        };

        // Cache the status for future requests
        await this.cacheService.setJobRetrievalResult(jobId, {
          jobId,
          agentId: jobMetadata.agentId || '',
          userId: jobMetadata.userId,
          status: status.status as any,
          data: null,
          error: status.error,
          createdAt: status.createdAt,
          completedAt: status.finishedOn,
          source: 'database' as any,
        });

        logger.debug(
          `Retrieved job status from metadata for ${jobId} (user: ${userId})`
        );
        return {
          id: jobId,
          status: status.status,
          error: status.error,
          createdAt: status.createdAt,
          processedOn: status.processedOn,
          finishedOn: status.finishedOn,
        };
      }
    } catch (error) {
      logger.error(`Failed to get job metadata for ${jobId}:`, error);
    }

    const fileIngestionQueue = this.workerManager
      .getJobProcessor()
      .getFileIngestionQueue();

    const job = await fileIngestionQueue.getQueue().getJob(jobId);

    if (!job) {
      logger.warn(`Job ${jobId} not found in queue`);
      return null;
    }

    if (job.data.userId !== userId) {
      throw new Error('Access denied: Job does not belong to user');
    }

    const jobState = await job.getState();
    logger.info(`Job ${jobId} state from Bull queue: ${jobState}`);

    const status = {
      id: job.id?.toString() || '',
      status: jobState,
      error: job.failedReason,
      createdAt: new Date(job.timestamp),
      processedOn: job.processedOn ? new Date(job.processedOn) : undefined,
      finishedOn: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
    // Cache the status for future requests
    await this.cacheService.setJobRetrievalResult(jobId, {
      jobId,
      agentId: job.data.agentId || '',
      userId: userId,
      status: status.status as any,
      data: null,
      error: status.error,
      createdAt: status.createdAt,
      completedAt: status.finishedOn,
      source: 'bull' as any,
    });

    return status;
  }

  /**
   * Get job result by ID
   */
  async getJobResult(jobId: string): Promise<any> {
    const fileIngestionQueue = this.workerManager
      .getJobProcessor()
      .getFileIngestionQueue();

    const job = await fileIngestionQueue.getQueue().getJob(jobId);

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();

    if (state === 'failed') {
      throw new Error(job.failedReason || 'Job failed');
    }

    if (state !== 'completed') {
      throw new Error(
        `Job ${jobId} is not completed yet. Current status: ${state}`
      );
    }

    return job.returnvalue;
  }

  /**
   * Get job result by ID with user validation
   */
  async getJobResultForUser(jobId: string, userId: string): Promise<any> {
    try {
      // Get job result from metadata service
      const jobMetadata = await this.jobsMetadataService.getJobMetadataForUser(
        jobId,
        userId
      );
      if (!jobMetadata) {
        throw new JobNotFoundError(jobId);
      }

      const result = {
        status:
          jobMetadata.status === 'completed'
            ? 'completed'
            : jobMetadata.status === 'failed'
              ? 'failed'
              : 'processing',
        data: jobMetadata.result,
        error: jobMetadata.error,
      };

      switch (result.status) {
        case 'completed':
          return result.data;

        case 'processing':
          throw new JobNotCompletedError(jobId, result.status);

        case 'failed':
          throw new JobFailedError(jobId, result.error);

        default:
          throw new UnknownJobStatusError(jobId, result.status);
      }
    } catch (error) {
      logger.error(`Failed to get job result for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get metrics for all queues
   */
  async getQueueMetrics(): Promise<any> {
    return await this.workerManager.getMetrics();
  }

  /**
   * Check if workers are active
   */
  isActive(): boolean {
    return this.workerManager.isActive();
  }

  /**
   * Get the underlying worker manager instance
   */
  getWorkerManager(): WorkerManager {
    return this.workerManager;
  }

  /**
   * Get diagnostic information about the workers
   */
  async getDiagnostics(): Promise<any> {
    return await this.workerManager.getDiagnostics();
  }
}
