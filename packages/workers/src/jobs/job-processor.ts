import type { Job } from 'bull';
import {
  QueueManager,
  FileIngestionQueue,
} from '../queues/index.js';
import { FileIngestionProcessor } from './file-ingestion-processor.js';
import { logger } from '@snakagent/core';
import { EmbeddingsResult } from '../types/index.js';

export class JobProcessor {
  private readonly queueManager: QueueManager;
  private fileIngestionQueue: FileIngestionQueue | null = null;
  private readonly fileIngestionProcessor: FileIngestionProcessor;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    this.fileIngestionProcessor = new FileIngestionProcessor();
  }

  async initialize(): Promise<void> {
    this.fileIngestionQueue = new FileIngestionQueue(this.queueManager);
  }

  async startProcessing(): Promise<void> {
    const config = this.queueManager.getConfig();

    await this.startFileIngestionProcessing(config.concurrency.fileIngestion);

    logger.info('All job processors started');
  }

  private async startFileIngestionProcessing(
    concurrency: number
  ): Promise<void> {
    if (!this.fileIngestionQueue) {
      throw new Error('FileIngestionQueue not initialized');
    }
    const queue = this.fileIngestionQueue.getQueue();

    queue.on('failed', (job, err) => {
      logger.error(`File ingestion job ${job.id} failed:`, err);
    });

    queue.on('stalled', (job) => {
      logger.warn(`File ingestion job ${job.id} stalled`);
    });

    queue.process(concurrency, async (job) => {
      return await this.processFileIngestion(job);
    });
    logger.info(
      `File ingestion processor started with concurrency: ${concurrency}`
    );
  }

  private async processFileIngestion(job: Job): Promise<EmbeddingsResult> {
    return await this.fileIngestionProcessor.process(job);
  }

  async stopProcessing(): Promise<void> {
    const config = this.queueManager.getConfig();

    await this.queueManager.pauseQueue(config.queues.fileIngestion);
    await this.queueManager.pauseQueue(config.queues.embeddings);

    logger.info('All job processors stopped');
  }

  getFileIngestionQueue(): FileIngestionQueue {
    if (!this.fileIngestionQueue) {
      throw new Error('FileIngestionQueue not initialized');
    }
    return this.fileIngestionQueue;
  }
}
