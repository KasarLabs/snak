import { QueueManager } from './queues/queue-manager.js';
import { JobProcessor } from './jobs/job-processor.js';
import { FileIngestionProcessor } from './jobs/file-ingestion-processor.js';
import { FileIngestionWorkerService } from './services/file-ingestion-worker/file-ingestion-worker.service.js';
import { ChunkingService } from './services/chunking/chunking.service.js';
import { EmbeddingsService } from './services/embeddings/embeddings.service.js';
import { VectorStoreService } from './services/vector-store/vector-store.service.js';
import { FileValidationService } from '@snakagent/core';
import { JobsMetadataService } from './services/jobs/jobs-metadata.service.js';
import { QueueMetrics } from './types/index.js';
import { logger } from '@snakagent/core';
import { RedisCacheService } from './services/cache/redis-cache.service.js';
import { RedisMutexService } from './services/mutex/redis-mutex.service.js';
import { AgentCfgOutboxWorker } from './workers/agent-cfg-outbox.worker.js';

export class WorkerManager {
  private queueManager: QueueManager;
  private jobProcessor: JobProcessor;
  private jobsMetadataService: JobsMetadataService;
  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  private agentCfgOutboxWorker: AgentCfgOutboxWorker;

  constructor(
    redisConfig?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    },
    cacheService?: RedisCacheService,
    ingestionServices?: {
      chunkingService?: ChunkingService;
      embeddingsService?: EmbeddingsService;
      vectorStoreService?: VectorStoreService;
      fileIngestionWorkerService?: FileIngestionWorkerService;
    }
  ) {
    this.queueManager = new QueueManager(redisConfig);

    const chunkingService =
      ingestionServices?.chunkingService || new ChunkingService();
    const embeddingsService =
      ingestionServices?.embeddingsService || new EmbeddingsService();
    const vectorStoreService =
      ingestionServices?.vectorStoreService || new VectorStoreService();
    const fileValidationService = new FileValidationService();
    const redisMutexService = new RedisMutexService();
    const fileIngestionWorkerService =
      ingestionServices?.fileIngestionWorkerService ||
      new FileIngestionWorkerService(
        chunkingService,
        embeddingsService,
        vectorStoreService,
        fileValidationService,
        redisMutexService
      );
    const fileIngestionProcessor = new FileIngestionProcessor(
      fileIngestionWorkerService
    );

    this.jobsMetadataService = new JobsMetadataService(
      cacheService || new RedisCacheService(),
      this.queueManager,
      redisMutexService
    );

    this.jobProcessor = new JobProcessor(
      this.queueManager,
      fileIngestionProcessor,
      cacheService || new RedisCacheService(),
      this.jobsMetadataService
    );
    this.agentCfgOutboxWorker = new AgentCfgOutboxWorker();
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

      await this.jobProcessor.forceRestartProcessing();
      logger.info('Job processors started');

      await this.agentCfgOutboxWorker.start();
      logger.info('Agent config outbox worker started');

      this.isRunning = true;
      logger.info('Worker manager started successfully');

      this.setupGracefulShutdown();
    } catch (error: unknown) {
      logger.error('Failed to start worker manager:', error);
      try {
        await this.jobProcessor.stopProcessing();
      } catch (e) {
        logger.warn('Cleanup: jobProcessor.stopProcessing failed', e);
      }
      try {
        await this.agentCfgOutboxWorker.stop();
      } catch (e) {
        logger.warn('Cleanup: agentCfgOutboxWorker.stop failed', e);
      }
      try {
        await this.queueManager.close();
      } catch (e) {
        logger.warn('Cleanup: queueManager.close failed', e);
      }
      this.isRunning = false;
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

      await this.agentCfgOutboxWorker.stop();
      logger.info('Agent config outbox worker stopped');

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

  /**
   * Get diagnostic information about the worker manager state
   */
  async getDiagnostics(): Promise<{
    isRunning: boolean;
    jobProcessor: any;
  }> {
    return {
      isRunning: this.isRunning,
      jobProcessor: await this.jobProcessor.getDiagnostics(),
    };
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        logger.info(`Already shutting down, ignoring ${signal}`);
        return;
      }
      this.isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);
      try {
        await this.stop();
        process.exit(0);
      } catch (err) {
        logger.error('Graceful shutdown failed:', err);
        process.exit(1);
      }
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  }
}
