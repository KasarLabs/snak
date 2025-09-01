import Bull, { Job, JobOptions, Queue } from 'bull';
import { JobType } from '../types/index.js';
import { QueueManager } from './queue-manager.js';

export interface EmbeddingsJobPayload {
  agentId: string;
  userId: string;
  texts: string[];
  metadata?: Record<string, any>;
}

export class EmbeddingsQueue {
  private queueManager: QueueManager;
  private queue: Queue;
  private readonly queueName: string;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    const cfg = queueManager.getConfig();
    const queueName = cfg?.queues?.embeddings;
    if (!queueName) {
      throw new Error(
        'Embeddings queue is not configured (config.queues.embeddings).'
      );
    }
    const q = queueManager.getQueue(queueName);
    if (!q) {
      throw new Error(`Embeddings queue "${queueName}" is not registered.`);
    }
    this.queueName = queueName;
    this.queue = q;
  }

  async addEmbeddingsJob(
    payload: EmbeddingsJobPayload,
    options?: JobOptions
  ): Promise<Job> {
    if (!payload?.agentId || !payload?.userId) {
      throw new Error('agentId and userId are required.');
    }
    if (!Array.isArray(payload.texts) || payload.texts.length === 0) {
      throw new Error('texts must be a non-empty array.');
    }

    return await this.queueManager.addJob(
      this.queueName,
      JobType.EMBEDDINGS_GENERATION,
      payload,
      options
    );
  }

  getQueue(): Queue {
    return this.queue;
  }
}
