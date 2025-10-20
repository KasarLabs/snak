import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DatabaseConfigService, logger } from '@snakagent/core';
import { metrics } from '@snakagent/metrics';

import { Postgres } from '../database.js';
import { RedisClient } from '../redis.js';

const DEFAULT_BATCH_SIZE = 200;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_REDIS_CHANNEL = 'agent_cfg_updates';

interface AgentCfgOutboxRow {
  id: number;
  agent_id: string;
  cfg_version: number;
  event: string;
  processed_at: Date;
}

export interface AgentCfgOutboxWorkerOptions {
  batchSize?: number;
  pollIntervalMs?: number;
  redisChannel?: string;
}

export class AgentCfgOutboxWorker {
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly redisChannel: string;
  private running = false;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private disposed = false;
  private readonly redisClient = RedisClient.getInstance();

  constructor(options?: AgentCfgOutboxWorkerOptions) {
    this.batchSize =
      options?.batchSize ??
      (parseInt(process.env.AGENT_CFG_WORKER_BATCH_SIZE || '', 10) ||
        DEFAULT_BATCH_SIZE);

    this.pollIntervalMs =
      options?.pollIntervalMs ??
      (parseInt(process.env.AGENT_CFG_WORKER_POLL_INTERVAL_MS || '', 10) ||
        DEFAULT_POLL_INTERVAL_MS);

    this.redisChannel =
      options?.redisChannel ??
      process.env.AGENT_CFG_WORKER_REDIS_CHANNEL ??
      DEFAULT_REDIS_CHANNEL;
  }

  public async start(): Promise<void> {
    if (this.running) {
      logger.warn('AgentCfgOutboxWorker already running');
      return;
    }

    await this.ensureInitialized();

    this.running = true;
    logger.info('AgentCfgOutboxWorker started');

    while (this.running) {
      let processed = 0;
      try {
        processed = await this.processBatch();
      } catch (error) {
        logger.error('AgentCfgOutboxWorker encountered an unexpected error', {
          error,
        });
        metrics.recordAgentCfgOutboxError('unexpected');
      }

      if (!this.running) {
        break;
      }

      if (processed === 0) {
        await delay(this.pollIntervalMs);
      }
    }

    logger.info('AgentCfgOutboxWorker stopped');

    await this.dispose();
  }

  public async stop(): Promise<void> {
    this.running = false;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initializing) {
      return this.initializing;
    }

    this.initializing = this.initialize();
    try {
      await this.initializing;
      this.initialized = true;
    } finally {
      this.initializing = null;
    }
  }

  private async initialize(): Promise<void> {
    try {
      if (!DatabaseConfigService.getInstance().isInitialized()) {
        DatabaseConfigService.getInstance().initialize();
      }

      const credentials =
        DatabaseConfigService.getInstance().getCredentials();

      await Postgres.connect(credentials);
      await this.redisClient.connect();
      this.disposed = false;
      logger.info('AgentCfgOutboxWorker initialized connections');
    } catch (error) {
      logger.error('Failed to initialize AgentCfgOutboxWorker', { error });
      throw error;
    }
  }

  private async processBatch(): Promise<number> {
    const rows = await this.fetchAndMarkBatch();
    if (rows.length === 0) {
      return 0;
    }

    const redis = this.redisClient.getClient();
    const processedPerEvent = new Map<string, number>();

    for (const row of rows) {
      try {
        const payload = JSON.stringify({
          agent_id: row.agent_id,
          cfg_version: row.cfg_version,
          event: row.event,
          processed_at: row.processed_at.toISOString(),
        });
        await redis.publish(this.redisChannel, payload);

        processedPerEvent.set(
          row.event,
          (processedPerEvent.get(row.event) ?? 0) + 1
        );
      } catch (error) {
        logger.error(
          `Failed to publish agent_cfg_outbox event ${row.id} to Redis`,
          { error }
        );
        metrics.recordAgentCfgOutboxError(row.event);
        await this.requeue(row.id, row.event);
      }
    }

    for (const [event, count] of processedPerEvent.entries()) {
      metrics.recordAgentCfgOutboxProcessed(count, event);
    }

    return Array.from(processedPerEvent.values()).reduce(
      (total, value) => total + value,
      0
    );
  }

  private async fetchAndMarkBatch(): Promise<AgentCfgOutboxRow[]> {
    try {
      return await metrics.dbResponseTime(
        'agent_cfg_outbox_fetch',
        async () => {
          const query = new Postgres.Query(
            `
            WITH locked AS (
              SELECT id, agent_id, cfg_version, event
              FROM agent_cfg_outbox
              WHERE processed_at IS NULL
              ORDER BY id
              LIMIT $1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE agent_cfg_outbox ao
            SET processed_at = NOW()
            FROM locked
            WHERE ao.id = locked.id
            RETURNING ao.id,
                     ao.agent_id,
                     ao.cfg_version,
                     ao.event,
                     ao.processed_at;
          `,
            [this.batchSize]
          );

          return Postgres.query<AgentCfgOutboxRow>(query);
        }
      );
    } catch (error) {
      logger.error('Failed to fetch agent_cfg_outbox batch', { error });
      metrics.recordAgentCfgOutboxError('fetch');
      return [];
    }
  }

  private async requeue(id: number, event: string): Promise<void> {
    try {
      await metrics.dbResponseTime('agent_cfg_outbox_requeue', async () => {
        const query = new Postgres.Query(
          `
          UPDATE agent_cfg_outbox
          SET processed_at = NULL
          WHERE id = $1
        `,
          [id]
        );
        await Postgres.query(query);
        return true;
      });
      metrics.recordAgentCfgOutboxRequeued(event);
    } catch (error) {
      logger.error(`Failed to requeue agent_cfg_outbox event ${id}`, {
        error,
      });
      metrics.recordAgentCfgOutboxError('requeue');
    }
  }

  private async dispose(): Promise<void> {
    if (this.disposed || !this.initialized) {
      return;
    }
    this.disposed = true;
    this.initialized = false;

    try {
      await this.redisClient.shutdown();
    } catch (error) {
      logger.error('Failed to shutdown Redis client', { error });
    }

    try {
      await Postgres.shutdown();
    } catch (error) {
      logger.error('Failed to shutdown Postgres pool', { error });
    }
  }
}

async function bootstrap(): Promise<void> {
  const worker = new AgentCfgOutboxWorker();

  let runningPromise: Promise<void> | null = null;

  const shutdown = async () => {
    await worker.stop();
    if (runningPromise) {
      await runningPromise;
    }
    process.exit(0);
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  runningPromise = worker.start();
  await runningPromise;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  bootstrap().catch(async (error) => {
    logger.error('AgentCfgOutboxWorker failed to start', { error });
    metrics.recordAgentCfgOutboxError('startup');
    process.exit(1);
  });
}
