import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DatabaseConfigService,
  logger,
  getGuardValue,
  DEFAULT_AGENT_CFG_REDIS_CHANNEL,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';

import { Postgres } from '../database.js';
import { RedisClient } from '../redis.js';
import { agentCfgOutbox } from '../queries/agent-cfg-outbox/queries.js';

interface AgentCfgOutboxRow {
  id: number;
  agent_id: string;
  cfg_version: number;
  event: string;
  claimed_at: Date | null;
  processed_at: Date | null;
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
    const guardBatchSize = getGuardValue(
      'agent_cfg_worker.batch_size'
    ) as number;
    const guardPollInterval = getGuardValue(
      'agent_cfg_worker.poll_interval_ms'
    ) as number;

    this.batchSize = options?.batchSize ?? guardBatchSize;
    this.pollIntervalMs = options?.pollIntervalMs ?? guardPollInterval;

    this.redisChannel =
      options?.redisChannel ??
      process.env.AGENT_CFG_WORKER_REDIS_CHANNEL ??
      DEFAULT_AGENT_CFG_REDIS_CHANNEL;
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

      const credentials = DatabaseConfigService.getInstance().getCredentials();

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
    const processedRows: Array<{ id: number; event: string }> = [];

    for (const row of rows) {
      try {
        const processedAtDate =
          this.parseTimestamp(row.processed_at) ?? new Date();
        const payload = JSON.stringify({
          agent_id: row.agent_id,
          cfg_version: row.cfg_version,
          event: row.event,
          processed_at: processedAtDate.toISOString(),
        });
        await redis.publish(this.redisChannel, payload);

        processedPerEvent.set(
          row.event,
          (processedPerEvent.get(row.event) ?? 0) + 1
        );
        processedRows.push({ id: row.id, event: row.event });
      } catch (error) {
        logger.error(
          `Failed to publish agent_cfg_outbox event ${row.id} to Redis`,
          { error }
        );
        metrics.recordAgentCfgOutboxError(row.event);
        await this.requeue(row.id, row.event);
      }
    }

    if (processedRows.length > 0) {
      try {
        await agentCfgOutbox.markProcessed(processedRows.map((row) => row.id));
        for (const [event, count] of processedPerEvent.entries()) {
          metrics.recordAgentCfgOutboxProcessed(count, event);
        }
      } catch (error) {
        logger.error('Failed to mark agent_cfg_outbox rows as processed', {
          error,
          rows: processedRows,
        });
        for (const row of processedRows) {
          await this.requeue(row.id, row.event);
        }
      }
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
          return agentCfgOutbox.fetchAndMarkBatch(this.batchSize);
        }
      );
    } catch (error) {
      logger.error('Failed to fetch agent_cfg_outbox batch', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name || typeof error,
      });
      metrics.recordAgentCfgOutboxError('fetch');
      return [];
    }
  }

  private async requeue(id: number, event: string): Promise<void> {
    try {
      await metrics.dbResponseTime('agent_cfg_outbox_requeue', async () => {
        await agentCfgOutbox.requeue(id);
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

  private parseTimestamp(value: unknown): Date | null {
    if (value == null) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
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
