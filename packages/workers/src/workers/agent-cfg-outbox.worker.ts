import { setTimeout as delay } from 'node:timers/promises';

import { Postgres } from '@snakagent/database';
import { RedisClient } from '@snakagent/database/redis';
import {
  agentCfgOutbox,
  agents,
  redisAgents,
} from '@snakagent/database/queries';
import {
  DatabaseConfigService,
  logger,
  getGuardValue,
  DEFAULT_AGENT_CFG_REDIS_CHANNEL,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';

interface AgentCfgOutboxMetrics {
  dbResponseTime<T>(query: string, fn: () => Promise<T>): Promise<T>;
  recordAgentCfgOutboxProcessed(count: number, event?: string): void;
  recordAgentCfgOutboxError(event?: string): void;
  recordAgentCfgOutboxRequeued(event?: string): void;
}

const outboxMetrics = metrics as unknown as AgentCfgOutboxMetrics;

type AgentCfgOutboxRow = agentCfgOutbox.OutboxRow;

export interface AgentCfgOutboxWorkerOptions {
  batchSize?: number;
  pollIntervalMs?: number;
  redisChannel?: string;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
}

export class AgentCfgOutboxWorker {
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly redisChannel: string;
  private readonly redisClient = RedisClient.getInstance();
  private running = false;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private loopPromise: Promise<void> | null = null;

  constructor(private readonly options?: AgentCfgOutboxWorkerOptions) {
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

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('AgentCfgOutboxWorker already running');
      return;
    }

    await this.ensureInitialized();

    this.running = true;
    logger.info('AgentCfgOutboxWorker started');

    this.loopPromise = this.runLoop().catch((error) => {
      logger.error('AgentCfgOutboxWorker loop terminated with error', {
        error,
      });
      outboxMetrics.recordAgentCfgOutboxError('loop');
      this.running = false;
    });
  }

  async stop(): Promise<void> {
    if (!this.running && !this.loopPromise) {
      return;
    }

    this.running = false;

    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } finally {
        this.loopPromise = null;
      }
    } else {
      await this.dispose();
    }

    logger.info('AgentCfgOutboxWorker stopped');
  }

  private async runLoop(): Promise<void> {
    try {
      while (this.running) {
        let processed = 0;
        try {
          processed = await this.processBatch();
        } catch (error) {
          logger.error(
            'AgentCfgOutboxWorker encountered an unexpected error while processing batch',
            { error }
          );
          outboxMetrics.recordAgentCfgOutboxError('unexpected');
        }

        if (!this.running) {
          break;
        }

        if (processed === 0) {
          await delay(this.pollIntervalMs);
        }
      }
    } finally {
      await this.dispose();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      await this.initializing;
      return;
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
      const dbConfig = DatabaseConfigService.getInstance();
      if (!dbConfig.isInitialized()) {
        dbConfig.initialize();
      }

      await Postgres.connect(dbConfig.getCredentials());

      const redisConfig = {
        host: this.options?.redis?.host ?? process.env.REDIS_HOST ?? 'redis',
        port:
          this.options?.redis?.port ??
          parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: this.options?.redis?.password ?? process.env.REDIS_PASSWORD,
        db:
          this.options?.redis?.db ?? parseInt(process.env.REDIS_DB ?? '0', 10),
      };

      await this.redisClient.connect(redisConfig);

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

    logger.info(`AgentCfgOutboxWorker processing ${rows.length} rows`);

    const redis = this.redisClient.getClient();
    const processedPerEvent = new Map<string, number>();
    const processedRows: Array<{ id: number; event: string }> = [];

    for (const row of rows) {
      try {
        await this.syncAgentToRedis(row, redis);

        // Also publish the event for any other listeners
        const processedAtDate =
          this.parseTimestamp(row.processed_at) ?? new Date();
        const payload = JSON.stringify({
          outbox_id: row.id,
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
        logger.error(`Failed to process agent_cfg_outbox event ${row.id}`, {
          error,
          event: row.event,
          agent_id: row.agent_id,
        });
        outboxMetrics.recordAgentCfgOutboxError(row.event);
        await this.requeue(row.id, row.event);
      }
    }

    if (processedRows.length > 0) {
      try {
        await agentCfgOutbox.markProcessed(processedRows.map((row) => row.id));
        for (const [event, count] of processedPerEvent.entries()) {
          outboxMetrics.recordAgentCfgOutboxProcessed(count, event);
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
      return await outboxMetrics.dbResponseTime(
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
      outboxMetrics.recordAgentCfgOutboxError('fetch');
      return [];
    }
  }

  private async syncAgentToRedis(
    row: AgentCfgOutboxRow,
    redis: any
  ): Promise<void> {
    const { agent_id, event } = row;

    switch (event) {
      case 'cfg_created':
      case 'cfg_updated':
        await this.syncAgentCreateOrUpdate(agent_id, redis);
        break;
      case 'cfg_deleted':
        await this.syncAgentDelete(agent_id, redis);
        break;
      default:
        logger.warn(`Unknown event type: ${event} for agent ${agent_id}`);
    }
  }

  private async syncAgentCreateOrUpdate(
    agentId: string,
    redis: any
  ): Promise<void> {
    try {
      // CRITICAL: Invalidate the agent_cfg cache before reading to ensure we get fresh data
      await this.invalidateAgentCfgCache(
        agentId,
        redis,
        'syncAgentCreateOrUpdate'
      );

      logger.info(
        `syncAgentCreateOrUpdate: Fetching agent ${agentId} from PostgreSQL`
      );
      // Get the latest agent configuration from PostgreSQL
      const agent = await (agents as any).getAgentCfg(agentId);

      if (!agent) {
        logger.warn(
          `Agent ${agentId} not found in PostgreSQL, skipping Redis sync`
        );
        return;
      }

      // Convert to the format expected by Redis queries
      const agentData = {
        id: agent.id,
        user_id: agent.user_id,
        profile: agent.profile,
        mcp_servers: agent.mcp_servers,
        prompts_id: agent.prompts_id,
        graph: agent.graph,
        memory: agent.memory,
        rag: agent.rag,
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        avatar_image: agent.avatar_image,
        avatar_mime_type: agent.avatar_mime_type,
      };

      // Check if agent exists in Redis
      const exists = await redisAgents.agentExists(agentId, agent.user_id);

      if (exists) {
        await redisAgents.updateAgent(agentData);
        logger.debug(`Updated agent ${agentId} in Redis`);
      } else {
        await redisAgents.saveAgent(agentData);
        logger.debug(`Created agent ${agentId} in Redis`);
      }
    } catch (error) {
      logger.error(`Failed to sync agent ${agentId} to Redis`, { error });
      throw error;
    }
  }

  private async syncAgentDelete(agentId: string, redis: any): Promise<void> {
    try {
      // Ensure cached agent_cfg payloads are purged alongside the agent document
      await this.invalidateAgentCfgCache(agentId, redis, 'syncAgentDelete');

      // We need to get the user_id from the outbox event or from a previous Redis entry
      // For now, we'll try to find the agent in Redis first to get the user_id
      const agentKey = `agents:${agentId}`;
      const agentJson = await redis.get(agentKey);

      if (!agentJson) {
        logger.debug(`Agent ${agentId} not found in Redis, skipping delete`);
        return;
      }

      const agent = JSON.parse(agentJson);
      const userId = agent.user_id;

      // Use the existing Redis queries to delete the agent
      await redisAgents.deleteAgent(agentId, userId);
      logger.debug(`Deleted agent ${agentId} from Redis`);
    } catch (error) {
      logger.error(`Failed to delete agent ${agentId} from Redis`, { error });
      throw error;
    }
  }

  private async invalidateAgentCfgCache(
    agentId: string,
    redis: any,
    context: string
  ): Promise<void> {
    const pointerKey = `agent_cfg:${agentId}:current`;
    const blobKeyPattern = `agent_cfg:${agentId}:blob:*`;

    logger.info(`${context}: Invalidating cache for agent ${agentId}`);
    await redis.del(pointerKey);

    // Delete all blob keys for this agent using SCAN (non-blocking)
    let cursor = '0';
    let deletedCount = 0;
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        blobKeyPattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    if (deletedCount > 0) {
      logger.info(
        `${context}: Deleted ${deletedCount} agent_cfg blob cache keys for agent ${agentId}`
      );
    }
  }

  private async requeue(id: number, event: string): Promise<void> {
    try {
      await outboxMetrics.dbResponseTime(
        'agent_cfg_outbox_requeue',
        async () => {
          await agentCfgOutbox.requeue(id);
          return true;
        }
      );
      outboxMetrics.recordAgentCfgOutboxRequeued(event);
    } catch (error) {
      logger.error(`Failed to requeue agent_cfg_outbox event ${id}`, {
        error,
      });
      outboxMetrics.recordAgentCfgOutboxError('requeue');
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

  private async dispose(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      await this.redisClient.shutdown();
    } catch (error) {
      logger.error('Failed to shutdown Redis client', { error });
    }

    try {
      await Postgres.shutdown();
    } catch (error) {
      logger.error('Failed to shutdown Postgres pool', { error });
    } finally {
      this.initialized = false;
    }
  }
}
