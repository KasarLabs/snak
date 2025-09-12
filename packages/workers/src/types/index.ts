// Legacy interfaces - kept for backward compatibility
export interface JobData {
  id: string;
  type: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

// Legacy WorkerConfig - kept for backward compatibility
export interface LegacyWorkerConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queues: {
    fileIngestion: string;
    embeddings: string;
  };
  concurrency: {
    fileIngestion: number;
    embeddings: number;
  };
}

// Legacy QueueMetrics - kept for backward compatibility
export interface LegacyQueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export enum JobStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DELAYED = 'delayed',
  PAUSED = 'paused',
}

export enum JobType {
  FILE_INGESTION = 'file-ingestion',
  EMBEDDINGS_GENERATION = 'embeddings-generation',
}

export interface EmbeddingsResult {
  success: boolean;
  agentId: string;
  embeddingsCount: number;
  embeddings: number[][];
  processedAt: string;
  metadata?: Record<string, unknown>;
}

export interface FileIngestionResult {
  success: boolean;
  fileId: string;
  agentId: string;
  originalName: string;
  mimeType: string;
  size: number;
  processedAt: string;
  chunks: unknown[];
  chunksCount?: number;
  embeddingsCount?: number;
  processingTime?: number;
  userId?: string;
}

// Export file ingestion types
export * from './file-ingestion.js';

// Export jobs types
export * from './jobs.js';

// Export workers types
export * from './workers.js';
