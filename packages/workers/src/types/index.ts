export interface JobData {
  id: string;
  type: string;
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface WorkerConfig {
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

export interface QueueMetrics {
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
}
