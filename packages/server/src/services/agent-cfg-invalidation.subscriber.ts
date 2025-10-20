import { Redis, type RedisOptions } from 'ioredis';
import { logger } from '@snakagent/core';
import type AgentRuntimeManager from './agent-runtime.manager.js';

export interface AgentCfgInvalidationSubscriberOptions {
  channel?: string;
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
}

interface InvalidationEvent {
  agentId: string;
  cfgVersion: number;
}

const DEFAULT_CHANNEL = 'agent_cfg_invalidate';

const parseInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export class AgentCfgInvalidationSubscriber {
  private readonly channel: string;
  private readonly redisOptions: RedisOptions;
  private subscriber: Redis | null = null;
  private readonly onMessageBound: (channel: string, payload: string) => void;

  constructor(
    private readonly runtimeManager: AgentRuntimeManager,
    options?: AgentCfgInvalidationSubscriberOptions
  ) {
    this.channel =
      options?.channel ??
      process.env.AGENT_CFG_INVALIDATE_CHANNEL ??
      DEFAULT_CHANNEL;

    const redisConfig = options?.redis ?? {};
    this.redisOptions = {
      host: redisConfig.host ?? process.env.REDIS_HOST ?? 'redis',
      port: redisConfig.port ?? parseInteger(process.env.REDIS_PORT, 6379),
      password: redisConfig.password ?? process.env.REDIS_PASSWORD ?? undefined,
      db: redisConfig.db ?? parseInteger(process.env.REDIS_DB, 0),
      lazyConnect: true,
    };

    this.onMessageBound = (channel: string, payload: string) => {
      if (channel !== this.channel) {
        return;
      }

      this.handlePayload(payload).catch((error) => {
        logger.error('Failed to process agent_cfg_invalidate payload', {
          error,
        });
      });
    };
  }

  async start(): Promise<void> {
    if (this.subscriber) {
      return;
    }

    const subscriber = new Redis(this.redisOptions);
    this.subscriber = subscriber;

    subscriber.on('error', (error) => {
      logger.error('agent_cfg_invalidate subscriber Redis error', { error });
    });

    subscriber.on('end', () => {
      logger.warn('agent_cfg_invalidate subscriber Redis connection closed');
    });

    subscriber.on('reconnecting', () => {
      logger.warn('agent_cfg_invalidate subscriber Redis reconnecting');
    });

    try {
      await subscriber.connect();
      await subscriber.subscribe(this.channel);
      subscriber.on('message', this.onMessageBound);
      logger.info(
        `Subscribed to Redis channel ${this.channel} for agent config invalidation`
      );
    } catch (error) {
      logger.error(`Failed to subscribe to Redis channel ${this.channel}`, {
        error,
      });
      subscriber.removeAllListeners();
      try {
        await subscriber.quit();
      } catch {
        // ignore quit errors during startup cleanup
      }
      this.subscriber = null;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    const subscriber = this.subscriber;
    this.subscriber = null;

    try {
      subscriber.removeListener('message', this.onMessageBound);
      await subscriber.unsubscribe(this.channel);
    } catch (error) {
      logger.warn(`Failed to unsubscribe from Redis channel ${this.channel}`, {
        error,
      });
    }

    try {
      await subscriber.quit();
    } catch (error) {
      logger.warn(
        'Failed to close Redis connection for invalidation subscriber',
        {
          error,
        }
      );
    }
  }

  private async handlePayload(raw: string): Promise<void> {
    const event = this.parseEvent(raw);
    if (!event) {
      return;
    }

    try {
      await this.runtimeManager.onInvalidate(event.agentId, event.cfgVersion);
    } catch (error) {
      logger.error('runtimeManager.onInvalidate failed', {
        error,
        agentId: event.agentId,
        cfgVersion: event.cfgVersion,
      });
    }
  }

  private parseEvent(raw: string): InvalidationEvent | null {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      logger.warn('Received invalid JSON on agent_cfg_invalidate channel', {
        raw,
        error,
      });
      return null;
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      logger.warn(
        'Received non-object payload on agent_cfg_invalidate channel',
        {
          payload: parsed,
        }
      );
      return null;
    }

    const agentId = Reflect.get(parsed, 'agentId');
    const cfgVersionRaw = Reflect.get(parsed, 'cfgVersion');

    if (typeof agentId !== 'string' || agentId.length === 0) {
      logger.warn('Received invalid agentId on agent_cfg_invalidate channel', {
        payload: parsed,
      });
      return null;
    }

    const cfgVersion =
      typeof cfgVersionRaw === 'number'
        ? cfgVersionRaw
        : typeof cfgVersionRaw === 'string'
          ? Number.parseInt(cfgVersionRaw, 10)
          : Number.NaN;

    if (!Number.isFinite(cfgVersion)) {
      logger.warn(
        'Received invalid cfgVersion on agent_cfg_invalidate channel',
        {
          payload: parsed,
        }
      );
      return null;
    }

    return { agentId, cfgVersion };
  }
}
