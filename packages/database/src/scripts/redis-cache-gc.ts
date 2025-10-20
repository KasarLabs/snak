import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { logger } from '@snakagent/core';

import { RedisClient } from '../redis.js';

const DEFAULT_CACHE_TTL_SECONDS = 300;

const resolveTtlSeconds = (): number => {
  const raw = process.env.AGENT_CFG_CACHE_TTL_SECONDS;
  if (!raw) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }
  return parsed;
};

export interface RedisGcStats {
  scanned: number;
  removed: number;
  ttlReapplied: number;
  pointersCleared: number;
}

export async function cleanupAgentCfgCache(): Promise<RedisGcStats> {
  const redisClient = RedisClient.getInstance();
  await redisClient.connect();
  const redis = redisClient.getClient();

  const ttlSeconds = resolveTtlSeconds();
  const stats: RedisGcStats = {
    scanned: 0,
    removed: 0,
    ttlReapplied: 0,
    pointersCleared: 0,
  };

  let cursor = '0';

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'agent_cfg:*',
      'COUNT',
      '500'
    );
    cursor = nextCursor;
    stats.scanned += keys.length;

    // Process one key at a time to keep memory bounded and backpressure manageable
    for (const key of keys) {
      const ttl = await redis.pttl(key);
      if (ttl === -2) {
        continue; // Key vanished between SCAN and TTL check
      }

      if (ttl <= 0) {
        await redis.del(key);
        stats.removed += 1;
        continue;
      }

      if (key.endsWith(':current')) {
        const blobKey = await redis.get(key);
        if (!blobKey) {
          await redis.del(key);
          stats.pointersCleared += 1;
          continue;
        }

        const blobExists = await redis.exists(blobKey);
        if (blobExists === 0) {
          await redis.del(key);
          stats.pointersCleared += 1;
          continue;
        }
      }

      if (ttl === -1) {
        await redis.expire(key, ttlSeconds);
        stats.ttlReapplied += 1;
      }
    }
  } while (cursor !== '0');

  await redisClient.shutdown();

  logger.info('Redis cache GC finished', stats);
  return stats;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  typeof process.argv[1] === 'string' &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  cleanupAgentCfgCache()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Redis cache GC failed', { error });
      process.exit(1);
    });
}
