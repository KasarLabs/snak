import Bull, { Job, JobOptions, Queue } from 'bull';
import { Redis } from 'ioredis';
import { WorkerConfig, QueueMetrics, JobType } from '../types/index.js';
import { loadWorkerConfig } from '../config/worker-config.js';
import { logger } from '@snakagent/core';

export class QueueManager {
  private redis: Redis;
  private queues: Map<string, Queue>;
  private config: WorkerConfig;
  private initialized = false;

  constructor(redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }) {
    try {
      this.config = loadWorkerConfig();
      if (!this.config || !this.config.queues) {
        throw new Error('Invalid worker configuration: missing queues config');
      }
    } catch (error) {
      logger.error('Failed to load worker config:', error);
      throw new Error('Failed to initialize QueueManager: invalid configuration');
    }

    // Use provided Redis config or fall back to worker config
    const redisSettings = redisConfig || this.config.redis;

    this.redis = new Redis({
      host: redisSettings.host,
      port: redisSettings.port,
      password: redisSettings.password,
      db: redisSettings.db,
    });
    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
    
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });
    this.queues = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('QueueManager already initialized');
      return;
    }
    // Initialize all queues
    const queueNames = Object.values(this.config.queues);

    if (queueNames.length === 0) {
      logger.warn('No queues configured');
      this.initialized = true;
      return;
    }

    for (const queueName of queueNames) {
      if (!queueName || typeof queueName !== 'string') {
        logger.error(`Invalid queue name: ${queueName}`);
        continue;
      }
      const queue = new Bull(queueName, {
        redis: {
          host: this.redis.options.host,
          port: this.redis.options.port,
          password: this.redis.options.password,
          db: this.redis.options.db,
        },
      });

      this.queues.set(queueName, queue);

      queue.on('error', (error) => {
        logger.error(`Queue ${queueName} error:`, error);
      });

      queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} in queue ${queueName} failed:`, err);
      });
    }
    this.initialized = true;
    logger.info(`Initialized ${this.queues.size} queue(s)`);
  }

  getQueue(queueName: string): Queue | undefined {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    return this.queues.get(queueName);
  }

  async addJob(
    queueName: string,
    jobType: JobType,
    payload: Record<string, any>,
    options?: JobOptions
  ): Promise<Job> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.add(jobType, payload, options);
  }

  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    return {
      queueName,
      waiting: waiting.length ?? 0,
      active: active.length ?? 0,
      completed: completed.length ?? 0,
      failed: failed.length ?? 0,
      delayed: delayed.length ?? 0,
    };
  }

  async getAllQueueMetrics(): Promise<QueueMetrics[]> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    const metrics: QueueMetrics[] = [];

    for (const queueName of this.queues.keys()) {
      try {
        const metric = await this.getQueueMetrics(queueName);
        metrics.push(metric);
      } catch (error) {
        logger.error(`Failed to get metrics for queue ${queueName}:`, error);
      }
    }

    return metrics;
  }

  async pauseQueue(queueName: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('QueueManager not initialized. Call initialize() first.');
    }
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.resume();
  }

  async close(): Promise<void> {
    logger.info('Closing queue manager...');

    // Close all queues
    const closePromises = Array.from(this.queues.values()).map(
      async (queue) => {
        try {
          await queue.close();
          logger.debug(`Queue ${queue.name} closed successfully`);
        } catch (error) {
          logger.error(`Error closing queue ${queue.name}:`, error);
        }
      }
    );

    await Promise.all(closePromises);
    this.queues.clear();

    // Close Redis connection
    try {
      await this.redis.quit();
      logger.info('Redis connection closed successfully');
    } catch (error) {
      logger.error('Error closing Redis connection:', error);
    }

    logger.info('Queue manager closed successfully');
  }

  getConfig(): WorkerConfig {
    return this.config;
  }
}
