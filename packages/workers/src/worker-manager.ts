import { QueueManager } from './queues/queue-manager.js';
import { JobProcessor } from './jobs/job-processor.js';
import { QueueMetrics } from './types/index.js';
import { logger } from '@snakagent/core';

export class WorkerManager {
  private queueManager: QueueManager;
  private jobProcessor: JobProcessor;
  private isRunning: boolean = false;

  constructor() {
    this.queueManager = new QueueManager();
    this.jobProcessor = new JobProcessor(this.queueManager);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Worker manager is already running');
      return;
    }

    try {
      logger.info('Starting worker manager...');

      await this.queueManager.initialize();
      logger.info('Queue manager initialized');

      await this.jobProcessor.initialize();
      logger.info('Job processor initialized');

      await this.jobProcessor.startProcessing();
      logger.info('Job processors started');

      this.isRunning = true;
      logger.info('Worker manager started successfully');

      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('Failed to start worker manager:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.info('Worker manager is not running');
      return;
    }

    try {
      logger.info('Stopping worker manager...');

      await this.jobProcessor.stopProcessing();
      logger.info('Job processors stopped');

      await this.queueManager.close();
      logger.info('Queue manager closed');

      this.isRunning = false;
      logger.info('Worker manager stopped successfully');
    } catch (error) {
      logger.error('Error stopping worker manager:', error);
      throw error;
    }
  }

  async getMetrics(): Promise<QueueMetrics[]> {
    return await this.queueManager.getAllQueueMetrics();
  }

  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    return await this.queueManager.getQueueMetrics(queueName);
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getQueueManager(): QueueManager {
    return this.queueManager;
  }

  getJobProcessor(): JobProcessor {
    return this.jobProcessor;
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  }
}
