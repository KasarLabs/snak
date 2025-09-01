import { z } from 'zod';
import { WorkerConfig } from '../types/index.js';

const configSchema = z.object({
  redis: z.object({
    host: z.string().default('redis'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(0),
  }),
  queues: z.object({
    fileIngestion: z.string().default('file-ingestion'),
    embeddings: z.string().default('embeddings'),
    agentExecution: z.string().default('agent-execution'),
    cleanup: z.string().default('cleanup'),
  }),
  concurrency: z.object({
    fileIngestion: z.number().default(2),
    embeddings: z.number().default(2),
    agentExecution: z.number().default(2),
    cleanup: z.number().default(2),
    fallbackWorkers: z.number().default(8),
    workerIdleTimeout: z.number().default(30000),
  }),
});

export function loadWorkerConfig(): WorkerConfig {
  const config = {
    redis: {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    },
    queues: {
      fileIngestion: process.env.QUEUE_FILE_INGESTION || 'file-ingestion',
      embeddings: process.env.QUEUE_EMBEDDINGS || 'embeddings',
      agentExecution: process.env.QUEUE_AGENT_EXECUTION || 'agent-execution',
      cleanup: process.env.QUEUE_CLEANUP || 'cleanup',
    },
    concurrency: {
      fileIngestion: parseInt(process.env.CONCURRENCY_FILE_INGESTION || '2'),
      embeddings: parseInt(process.env.CONCURRENCY_EMBEDDINGS || '2'),
      agentExecution: parseInt(process.env.CONCURRENCY_AGENT_EXECUTION || '2'),
      cleanup: parseInt(process.env.CONCURRENCY_CLEANUP || '2'),
      fallbackWorkers: parseInt(process.env.CONCURRENCY_FALLBACK_WORKERS || '8'),
      workerIdleTimeout: parseInt(process.env.CONCURRENCY_WORKER_IDLE_TIMEOUT || '30000'),
    },
  };

  return configSchema.parse(config);
}
