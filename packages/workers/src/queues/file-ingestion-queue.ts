import { Job, JobOptions, Queue } from 'bull';
import { JobType } from '../types/index.js';
import { QueueManager } from './queue-manager.js';
import { 
  FileIngestionJobPayload, 
  validateFileIngestionPayload 
} from './file-ingestion-queue.schema.js';

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
    payload: unknown,
    options?: JobOptions
  ): Promise<Job> {
    const validatedPayload = validateFileIngestionPayload(payload);
    
    return await this.queueManager.addJob(
      this.queueName,
      JobType.FILE_INGESTION,
      validatedPayload,
      options
    );
  }

  getQueue(): Queue {
    return this.queue;
  }
}
