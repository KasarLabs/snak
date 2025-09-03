import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WorkerManager } from '@snakagent/workers';
import { logger } from '@snakagent/core';

@Injectable()
export class WorkersService implements OnModuleInit, OnModuleDestroy {
  private workerManager: WorkerManager;

  constructor() {
    this.workerManager = new WorkerManager();
  }

  async onModuleInit() {
    try {
      logger.info('Initializing workers service...');
      await this.workerManager.start();
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

    logger.info(`File processing queued with job ID: ${job.id}`);
    return job.id.toString();
  }

  /**
   * Get metrics for all queues
   */
  async getQueueMetrics() {
    return await this.workerManager.getMetrics();
  }

  /**
   * Get status of a specific job
   */
  async getJobStatus(queueName: string, jobId: string): Promise<any> {
    const queue = this.workerManager.getQueueManager().getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return {
      id: job.id,
      status: await job.getState(),
      progress: job.progress(),
      result: job.returnvalue,
      failedReason: job.failedReason,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    };
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
}
