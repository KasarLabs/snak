import type { Job } from 'bull';
import {
  QueueManager,
  FileIngestionQueue,
  EmbeddingsQueue,
} from '../queues/index.js';
import { FileIngestionProcessor } from './file-ingestion-processor.js';
import { EmbeddingsProcessor } from './embeddings-processor.js';
import { logger } from '@snakagent/core';
import { EmbeddingsResult } from '../types/index.js';

export class JobProcessor {
  private readonly queueManager: QueueManager;
  private readonly fileIngestionQueue: FileIngestionQueue;
  private readonly embeddingsQueue: EmbeddingsQueue;
  private readonly fileIngestionProcessor: FileIngestionProcessor;
  private readonly embeddingsProcessor: EmbeddingsProcessor;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    this.fileIngestionQueue = new FileIngestionQueue(queueManager);
    this.embeddingsQueue = new EmbeddingsQueue(queueManager);
    this.fileIngestionProcessor = new FileIngestionProcessor();
    this.embeddingsProcessor = new EmbeddingsProcessor();
  }

  async startProcessing(): Promise<void> {
    const config = this.queueManager.getConfig();

    await this.startFileIngestionProcessing(config.concurrency.fileIngestion);
    await this.startEmbeddingsProcessing(config.concurrency.embeddings);

    logger.info('All job processors started');
  }

  private async startFileIngestionProcessing(
    concurrency: number
  ): Promise<void> {
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

  private async startEmbeddingsProcessing(concurrency: number): Promise<void> {
    const queue = this.embeddingsQueue.getQueue();

    queue.on('failed', (job, err) => {
      logger.error(`Embeddings job ${job.id} failed:`, err);
    });

    queue.on('stalled', (job) => {
      logger.warn(`Embeddings job ${job.id} stalled`);
    });

    queue.process(concurrency, async (job) => {
      return await this.processEmbeddings(job);
    });
    logger.info(
      `Embeddings processor started with concurrency: ${concurrency}`
    );
  }

  private async processFileIngestion(job: Job): Promise<EmbeddingsResult> {
    return await this.fileIngestionProcessor.process(job);
  }

  private async processEmbeddings(job: Job): Promise<EmbeddingsResult> {
    return await this.embeddingsProcessor.process(job);
  }

  async stopProcessing(): Promise<void> {
    const config = this.queueManager.getConfig();

    await this.queueManager.pauseQueue(config.queues.fileIngestion);
    await this.queueManager.pauseQueue(config.queues.embeddings);

    logger.info('All job processors stopped');
  }

  getFileIngestionQueue(): FileIngestionQueue {
    return this.fileIngestionQueue;
  }

  getEmbeddingsQueue(): EmbeddingsQueue {
    return this.embeddingsQueue;
  }
}
