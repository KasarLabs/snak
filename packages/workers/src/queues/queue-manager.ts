import Bull, { Job, JobOptions, Queue } from 'bull';
import Redis from 'ioredis';
import { WorkerConfig, QueueMetrics, JobType } from '../types/index.js';
import { loadWorkerConfig } from '../config/worker-config.js';
import { logger } from '@snakagent/core';

export class QueueManager {
  private redis: Redis;
  private queues: Map<string, Queue>;
  private config: WorkerConfig;

  constructor() {
    this.config = loadWorkerConfig();
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
    });
    this.queues = new Map();
  }

  async initialize(): Promise<void> {
    // Initialize all queues
    const queueNames = Object.values(this.config.queues);

    for (const queueName of queueNames) {
      const queue = new Bull(queueName, {
        redis: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          db: this.config.redis.db,
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
  }

  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }

  async addJob(
    queueName: string,
    jobType: JobType,
    payload: Record<string, any>,
    options?: JobOptions
  ): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await queue.add(jobType, payload, options);
  }

  async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
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
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    await queue.resume();
  }

  async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) =>
      queue.close()
    );
    await Promise.all(closePromises);
    await this.redis.quit();
  }

  getConfig(): WorkerConfig {
    return this.config;
  }
}
