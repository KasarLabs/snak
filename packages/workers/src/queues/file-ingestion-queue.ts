import { Job, JobOptions, Queue } from 'bull';
import { JobType } from '../types/index.js';
import { QueueManager } from './queue-manager.js';

export type FileIngestionJobPayload = {
  agentId: string;
  userId: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  size: number;
};

export class FileIngestionQueue {
  private readonly queueManager: QueueManager;
  private readonly queue: Queue<FileIngestionJobPayload>;
  private readonly queueName: string;

  constructor(queueManager: QueueManager) {
    this.queueManager = queueManager;
    const {
      queues: { fileIngestion },
    } = queueManager.getConfig();
    this.queueName = fileIngestion;
    const q = queueManager.getQueue(fileIngestion) as
      | Queue<FileIngestionJobPayload>
      | undefined;
    if (!q) {
      throw new Error(
        `FileIngestionQueue: queue "${fileIngestion}" not registered`
      );
    }
    this.queue = q;
  }

  async addFileIngestionJob(
    payload: FileIngestionJobPayload,
    options?: JobOptions
  ): Promise<Job> {
    return await this.queueManager.addJob(
      this.queueName,
      JobType.FILE_INGESTION,
      payload,
      options
    );
  }

  getQueue(): Queue {
    return this.queue;
  }
}
