import { z } from 'zod';
import type { WorkerConfig } from '../types/index.js';

export const configSchema = z
  .object({
    redis: z.object({
      host: z.string().min(1).default('redis'),
      port: z.coerce.number().int().min(1).max(65535).default(6379),
      password: z.string().optional(),
      db: z.number().int().min(0).default(0),
    }),
    queues: z
      .object({
        fileIngestion: z.string().min(1).default('file-ingestion'),
        embeddings: z.string().min(1).default('embeddings'),
      })
      .strict(),
    concurrency: z
      .object({
        fileIngestion: z.coerce.number().int().min(1).default(2),
        embeddings: z.coerce.number().int().min(1).default(2),
        fallbackWorkers: z.coerce.number().int().min(0).default(8),
        workerIdleTimeout: z.coerce.number().int().min(0).default(30000),
      })
      .strict(),
  })
  .strict();

export function loadWorkerConfig(): WorkerConfig {
  const config = {
    redis: {
      host: process.env.REDIS_HOST ?? 'redis',
      port: parseInt(process.env.REDIS_PORT ?? '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB ?? '0'),
    },
    queues: {
      fileIngestion: process.env.QUEUE_FILE_INGESTION ?? 'file-ingestion',
      embeddings: process.env.QUEUE_EMBEDDINGS ?? 'embeddings',
    },
    concurrency: {
      fileIngestion: parseInt(process.env.CONCURRENCY_FILE_INGESTION ?? '2'),
      embeddings: parseInt(process.env.CONCURRENCY_EMBEDDINGS ?? '2'),
      fallbackWorkers: parseInt(
        process.env.CONCURRENCY_FALLBACK_WORKERS ?? '8'
      ),
      workerIdleTimeout: parseInt(
        process.env.CONCURRENCY_WORKER_IDLE_TIMEOUT ?? '30000'
      ),
    },
  };

  return configSchema.parse(config);
}
