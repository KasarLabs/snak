import type { Job } from 'bull';
import { QueueManager, FileIngestionQueue } from '../queues/index.js';
import { FileIngestionProcessor } from './file-ingestion-processor.js';
import { logger } from '@snakagent/core';
import { FileIngestionResult, ResultSource, ResultStatus } from '../types/index.js';
import { CacheService } from '../services/cache/cache.service.js';
import { JobsMetadataService } from '../services/jobs/jobs-metadata.service.js';

export class JobProcessor {
  private readonly queueManager: QueueManager;
  private fileIngestionQueue: FileIngestionQueue | null = null;
  private readonly fileIngestionProcessor: FileIngestionProcessor;
  private readonly cacheService: CacheService;
  private isProcessingStarted: boolean = false;
  private isFileIngestionProcessorRegistered: boolean = false;

  constructor(
    queueManager: QueueManager,
    fileIngestionProcessor: FileIngestionProcessor,
    cacheService: CacheService,
    private readonly jobsMetadataService: JobsMetadataService
  ) {
    this.queueManager = queueManager;
    this.fileIngestionProcessor = fileIngestionProcessor;
    this.cacheService = cacheService;
  }

  async initialize(): Promise<void> {
    this.fileIngestionQueue = new FileIngestionQueue(this.queueManager);
  }

  async startProcessing(): Promise<void> {
    if (this.isProcessingStarted) {
      logger.info('Job processing is already started');
      return;
    }

    const config = this.queueManager.getConfig();

    // Always try to start processing, the method will handle duplicates
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

    // Check if processor is already registered
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

    // Remove all existing listeners to avoid duplicates
    queue.removeAllListeners();

    queue.on('error', (error) => {
      logger.error(`File ingestion queue error:`, error);
    });

    queue.on('failed', (job, err) => {
      logger.error(`File ingestion job ${job.id} failed:`, err);
    });

    queue.on('stalled', (job) => {
      logger.warn(`File ingestion job ${job.id} stalled`);
    });

    queue.on('active', (job) => {
      logger.info(`File ingestion job ${job.id} is now active`);
    });

    queue.on('completed', (job) => {
      logger.info(`File ingestion job ${job.id} completed successfully`);
    });

    queue.on('waiting', (jobId) => {
      logger.info(`File ingestion job ${jobId} is waiting`);
    });

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
    logger.info(`Processing file ingestion job ${job.id} with data:`, {
      agentId: job.data.agentId,
      userId: job.data.userId,
      fileId: job.data.fileId,
      originalName: job.data.originalName,
      size: job.data.size,
    });

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
          status: 'completed' as any,
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
          status: 'failed' as any, // 'failed' is valid in database
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

    // Reset state
    this.isProcessingStarted = false;
    this.isFileIngestionProcessorRegistered = false;

    // Restart processing
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
}
