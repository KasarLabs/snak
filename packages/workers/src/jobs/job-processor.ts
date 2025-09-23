import type { Job } from 'bull';
import { QueueManager, FileIngestionQueue } from '../queues/index.js';
import { FileIngestionProcessor } from './file-ingestion-processor.js';
import { logger } from '@snakagent/core';
import {
  FileIngestionResult,
  JobStatus,
  ResultSource,
  ResultStatus,
} from '../types/index.js';
import { RedisCacheService } from '../services/cache/redis-cache.service.js';
import { JobsMetadataService } from '../services/jobs/jobs-metadata.service.js';

export class JobProcessor {
  private readonly queueManager: QueueManager;
  private fileIngestionQueue: FileIngestionQueue | null = null;
  private readonly fileIngestionProcessor: FileIngestionProcessor;
  private readonly cacheService: RedisCacheService;
  private isProcessingStarted: boolean = false;
  private isFileIngestionProcessorRegistered: boolean = false;

  constructor(
    queueManager: QueueManager,
    fileIngestionProcessor: FileIngestionProcessor,
    cacheService: RedisCacheService,
    private readonly jobsMetadataService: JobsMetadataService
  ) {
    this.queueManager = queueManager;
    this.fileIngestionProcessor = fileIngestionProcessor;
    this.cacheService = cacheService;
  }

  async initialize(): Promise<void> {
    if (this.fileIngestionQueue) {
      logger.warn('JobProcessor already initialized');
      return;
    }
    this.fileIngestionQueue = new FileIngestionQueue(this.queueManager);
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessingStarted) {
      logger.info('Job processing is already started');
      return;
    }

    const config = this.queueManager.getConfig();

    await this.startFileIngestionProcessing(config.concurrency.fileIngestion);

    this.isProcessingStarted = true;
    logger.info('All job processors started');
  }

  private async startFileIngestionProcessing(
    concurrency: number
  ): Promise<void> {
    if (!this.fileIngestionQueue) {
      throw new Error('FileIngestionQueue not initialized');
    }
    const queue = this.fileIngestionQueue.getQueue();
    if (this.isFileIngestionProcessorRegistered) {
      logger.info(
        'File ingestion processor already registered, ensuring queue is active'
      );
      // Ensure the queue is not paused
      if (await queue.isPaused()) {
        await queue.resume();
        logger.info('File ingestion queue resumed');
      }
      return;
    }

    // Remove only our listeners to avoid duplicates
    queue.removeListener('error', this.handleQueueError);
    queue.removeListener('failed', this.handleJobFailed);
    queue.removeListener('stalled', this.handleJobStalled);
    queue.removeListener('active', this.handleJobActive);
    queue.removeListener('completed', this.handleJobCompleted);
    queue.removeListener('waiting', this.handleJobWaiting);

    queue.on('error', this.handleQueueError);
    queue.on('failed', this.handleJobFailed);
    queue.on('stalled', this.handleJobStalled);
    queue.on('active', this.handleJobActive);
    queue.on('completed', this.handleJobCompleted);
    queue.on('waiting', this.handleJobWaiting);

    // Ensure the queue is not paused before processing
    if (await queue.isPaused()) {
      await queue.resume();
      logger.info('File ingestion queue resumed');
    }

    try {
      queue.process(
        'file-ingestion',
        concurrency,
        this.handleFileIngestionJob.bind(this)
      );

      this.isFileIngestionProcessorRegistered = true;
      logger.info(
        `File ingestion processor started with concurrency: ${concurrency}`
      );
    } catch (error) {
      logger.error('Failed to register file ingestion processor:', error);
      throw error;
    }
  }

  private async handleFileIngestionJob(job: Job): Promise<FileIngestionResult> {
    try {
      const result = await this.processFileIngestion(job);
      logger.info(`File ingestion job ${job.id} completed successfully`);

      try {
        await this.cacheService.setJobRetrievalResult(job.id.toString(), {
          jobId: job.id.toString(),
          agentId: job.data.agentId,
          userId: job.data.userId,
          status: ResultStatus.COMPLETED,
          data: result,
          error: undefined,
          createdAt: new Date(job.timestamp),
          completedAt: new Date(),
          source: ResultSource.BULL,
        });

        await this.jobsMetadataService.updateJobMetadata(job.id.toString(), {
          status: JobStatus.COMPLETED,
          completedAt: new Date(),
          result: result,
        });

        logger.info(`Updated cache and metadata for completed job ${job.id}`);
      } catch (cacheError) {
        logger.error(
          `Failed to update cache/metadata for completed job ${job.id}:`,
          cacheError
        );
        // Don't throw here as the job itself succeeded
      }

      return result;
    } catch (error) {
      logger.error(`File ingestion job ${job.id} failed:`, error);

      try {
        await this.cacheService.setJobRetrievalResult(job.id.toString(), {
          jobId: job.id.toString(),
          agentId: job.data.agentId,
          userId: job.data.userId,
          status: ResultStatus.FAILED,
          data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
          createdAt: new Date(job.timestamp),
          completedAt: new Date(),
          source: ResultSource.BULL,
        });

        await this.jobsMetadataService.updateJobMetadata(job.id.toString(), {
          status: JobStatus.FAILED, // 'failed' is valid in database
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.info(`Updated cache and metadata for failed job ${job.id}`);
      } catch (cacheError) {
        logger.error(
          `Failed to update cache/metadata for failed job ${job.id}:`,
          cacheError
        );
        // Don't throw here as we want to preserve the original error
      }

      throw error;
    }
  }

  private async processFileIngestion(job: Job): Promise<FileIngestionResult> {
    return await this.fileIngestionProcessor.process(job);
  }

  async stopProcessing(): Promise<void> {
    if (!this.isProcessingStarted) {
      logger.info('Job processing is not started');
      return;
    }

    const config = this.queueManager.getConfig();

    await this.queueManager.pauseQueue(config.queues.fileIngestion);

    if (this.fileIngestionQueue) {
      const queue = this.fileIngestionQueue.getQueue();
      await queue.close();
      this.fileIngestionQueue = null;
    }

    this.isProcessingStarted = false;
    this.isFileIngestionProcessorRegistered = false;
    logger.info('All job processors stopped');
  }

  getFileIngestionQueue(): FileIngestionQueue {
    if (!this.fileIngestionQueue) {
      throw new Error('FileIngestionQueue not initialized');
    }
    return this.fileIngestionQueue;
  }

  /**
   * Reset the processor state - useful for debugging or recovery
   */
  reset(): void {
    this.isProcessingStarted = false;
    this.isFileIngestionProcessorRegistered = false;
    logger.info('Job processor state reset');
  }

  /**
   * Force restart processing - useful after application restart
   */
  async forceRestartProcessing(): Promise<void> {
    logger.info('Force restarting job processing...');

    if (!this.fileIngestionQueue) {
      await this.initialize();
    }

    this.isProcessingStarted = false;
    this.isFileIngestionProcessorRegistered = false;

    await this.startProcessing();

    logger.info('Job processing force restarted');
  }

  /**
   * Get diagnostic information about the processor state
   */
  async getDiagnostics(): Promise<{
    isProcessingStarted: boolean;
    isFileIngestionProcessorRegistered: boolean;
    queuePaused: boolean;
    queueName: string;
  }> {
    if (!this.fileIngestionQueue) {
      throw new Error('FileIngestionQueue not initialized');
    }

    const queue = this.fileIngestionQueue.getQueue();
    const queuePaused = await queue.isPaused();

    return {
      isProcessingStarted: this.isProcessingStarted,
      isFileIngestionProcessorRegistered:
        this.isFileIngestionProcessorRegistered,
      queuePaused,
      queueName: queue.name,
    };
  }

  // Event handler methods for proper listener management
  private readonly handleQueueError = (error: Error): void => {
    logger.error(`File ingestion queue error:`, error);
  };

  private readonly handleJobFailed = (job: Job, err: Error): void => {
    logger.error(`File ingestion job ${job.id} failed:`, err);
  };

  private readonly handleJobStalled = (job: Job): void => {
    logger.warn(`File ingestion job ${job.id} stalled`);
  };

  private readonly handleJobActive = (job: Job): void => {
    logger.info(`File ingestion job ${job.id} is now active`);
  };

  private readonly handleJobCompleted = (job: Job): void => {
    logger.info(`File ingestion job ${job.id} completed successfully`);
  };

  private readonly handleJobWaiting = (jobId: string): void => {
    logger.info(`File ingestion job ${jobId} is waiting`);
  };
}
