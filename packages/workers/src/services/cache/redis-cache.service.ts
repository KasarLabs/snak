/**
 * Redis-based cache service for workers package
 * Provides distributed caching functionality for job results and metadata
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { logger } from '@snakagent/core';
import { JobRetrievalResult } from '../../types/jobs.js';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private redis: Redis;

  constructor(redisConfig?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }) {
    const config = redisConfig || {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    };

    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      logger.error('Redis cache connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis cache connected successfully');
    });

    this.redis.on('ready', () => {
      logger.info('Redis cache ready');
    });
  }

  async onModuleDestroy() {
    try {
      await this.redis.disconnect();
      logger.info('Redis cache disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis cache:', error);
    }
  }

  /**
   * Set a job retrieval result in Redis cache
   */
  async setJobRetrievalResult(
    key: string,
    result: JobRetrievalResult,
    ttlMs?: number
  ): Promise<void> {
    try {
      const cacheKey = `job-result:${key}`;
      const serialized = JSON.stringify(result);

      if (ttlMs && ttlMs > 0) {
        const ttlSeconds = Math.floor(ttlMs / 1000);
        await this.redis.setex(cacheKey, ttlSeconds, serialized);
      } else {
        await this.redis.set(cacheKey, serialized);
      }

      logger.debug(`Cached job result in Redis for key: ${key}`);
    } catch (error) {
      logger.error(
        `Failed to cache job result in Redis for key ${key}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a job retrieval result from Redis cache
   */
  async getJobRetrievalResult(key: string): Promise<JobRetrievalResult | null> {
    try {
      const cacheKey = `job-result:${key}`;
      const result = await this.redis.get(cacheKey);

      if (!result) {
        return null;
      }

      const parsed = JSON.parse(result) as JobRetrievalResult;
      logger.debug(`Retrieved job result from Redis cache for key: ${key}`);
      return parsed;
    } catch (error) {
      logger.error(
        `Failed to get job result from Redis cache for key ${key}:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete a job retrieval result from Redis cache
   */
  async deleteJobRetrievalResult(key: string): Promise<void> {
    try {
      const cacheKey = `job-result:${key}`;
      await this.redis.del(cacheKey);
      logger.debug(`Deleted job result from Redis cache for key: ${key}`);
    } catch (error) {
      logger.error(
        `Failed to delete job result from Redis cache for key ${key}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clear all job result cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.scanKeys('job-result:*');
      if (keys.length > 0) {
        await this.redis.unlink(...keys);
      }
      logger.debug('Cleared all job-result:* entries');
    } catch (error) {
      logger.error('Failed to clear Redis cache:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ size: number; keys: string[] }> {
    try {
      const keys = await this.scanKeys('job-result:*');
      return {
        size: keys.length,
        keys: keys,
      };
    } catch (error) {
      logger.error('Failed to get Redis cache stats:', error);
      return { size: 0, keys: [] };
    }
  }

  /**
   * Flush all cache entries
   */
  async flushAll(): Promise<void> {
    try {
      await this.clear();
      logger.debug('Flushed all Redis cache entries');
    } catch (error) {
      logger.error('Failed to flush Redis cache:', error);
      throw error;
    }
  }

  /**
   * Set TTL for an existing cache entry
   */
  async setTTL(key: string, ttlMs: number): Promise<void> {
    try {
      const cacheKey = `job-result:${key}`;
      const ttlSeconds = Math.floor(ttlMs / 1000);
      await this.redis.expire(cacheKey, ttlSeconds);
      logger.debug(`Set TTL for key ${key} to ${ttlSeconds} seconds`);
    } catch (error) {
      logger.error(`Failed to set TTL for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const cacheKey = `job-result:${key}`;
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get the TTL of a cache entry
   */
  async getTTL(key: string): Promise<number> {
    try {
      const cacheKey = `job-result:${key}`;
      const ttl = await this.redis.ttl(cacheKey);
      return ttl;
    } catch (error) {
      logger.error(`Failed to get TTL for key ${key}:`, error);
      return -1;
    }
  }

  /**
   * Get Redis connection status
   */
  isConnected(): boolean {
    return this.redis.status === 'ready';
  }

  /**
   * Manually connect to Redis (useful for lazy connections)
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
      logger.info('Manual Redis connection established');
    } catch (error) {
      logger.error('Failed to manually connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Scan for keys matching a pattern using non-blocking SCAN command
   * @param match - Pattern to match (e.g., 'job-result:*')
   * @param count - Number of keys to scan per iteration (default: 1000)
   * @returns Array of matching keys
   */
  private async scanKeys(match: string, count = 1000): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];
    do {
      const [next, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        match,
        'COUNT',
        count
      );
      cursor = next;
      if (batch.length) keys.push(...batch);
    } while (cursor !== '0');
    return keys;
  }
}
