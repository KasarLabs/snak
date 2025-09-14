/**
 * Redis-based distributed mutex service for user file processing
 * Provides thread-safe mutex functionality using Redis locks
 */

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { logger } from '@snakagent/core';
import { randomUUID } from 'crypto';

export interface MutexConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface MutexOptions {
  timeout?: number; // Lock timeout in milliseconds
  retryDelay?: number; // Delay between retry attempts in milliseconds
  maxRetries?: number; // Maximum number of retry attempts
}

@Injectable()
export class RedisMutexService implements OnModuleDestroy {
  private redis: Redis;
  private readonly defaultTimeout = 5 * 60 * 1000; // 5 minutes
  private readonly defaultRetryDelay = 100; // 100ms
  private readonly defaultMaxRetries = 50; // 5 seconds total retry time

  constructor(redisConfig?: MutexConfig) {
    const config = redisConfig || {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    };

    // Security: Validate Redis authentication configuration
    if (!config.password || config.password.trim() === '') {
      const isProduction = process.env.NODE_ENV === 'production';
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (isProduction) {
        throw new Error(
          'REDIS_PASSWORD is required in production environment for security. ' +
          'Please set the REDIS_PASSWORD environment variable.'
        );
      }
      
      if (!isDevelopment) {
        logger.warn(
          'REDIS_PASSWORD not configured for RedisMutexService - using unauthenticated Redis connection. ' +
          'This is strongly discouraged outside of development environments.'
        );
      }
    }

    this.redis = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      lazyConnect: true,
    });

    this.redis.on('error', (error) => {
      logger.error('Redis mutex connection error:', error);
    });

    this.redis.on('connect', () => {
      logger.info('Redis mutex connected successfully');
    });

    this.redis.on('ready', () => {
      logger.info('Redis mutex ready');
    });
  }

  /**
   * Acquire a distributed mutex lock for a user
   * @param userId - The user ID to acquire the mutex for
   * @param options - Mutex options (timeout, retry settings)
   * @returns A function to release the mutex
   */
  async acquireUserMutex(
    userId: string, 
    options: MutexOptions = {}
  ): Promise<() => Promise<void>> {
    const {
      timeout = this.defaultTimeout,
      retryDelay = this.defaultRetryDelay,
      maxRetries = this.defaultMaxRetries
    } = options;

    const lockKey = `user_mutex:${userId}`;
    const lockValue = randomUUID();
    const lockExpiry = Math.ceil(timeout / 1000); // Convert to seconds

    let retries = 0;
    let acquired = false;

    // Try to acquire the lock
    while (!acquired && retries < maxRetries) {
      try {
        // Use SET with NX (only if not exists) and EX (expiry) for atomic lock acquisition
        const result = await this.redis.set(
          lockKey, 
          lockValue, 
          'PX', 
          timeout, 
          'NX'
        );

        if (result === 'OK') {
          acquired = true;
          logger.debug(`Mutex acquired for user ${userId}`, { lockKey, lockValue });
        } else {
          // Lock is held by another process, wait and retry
          retries++;
          if (retries < maxRetries) {
            await this.sleep(retryDelay);
          }
        }
      } catch (error) {
        logger.error(`Error acquiring mutex for user ${userId}:`, error);
        retries++;
        if (retries < maxRetries) {
          await this.sleep(retryDelay);
        }
      }
    }

    if (!acquired) {
      throw new Error(
        `Failed to acquire mutex for user ${userId} after ${maxRetries} retries`
      );
    }

    // Return release function
    return async () => {
      try {
        await this.releaseUserMutex(lockKey, lockValue);
        logger.debug(`Mutex released for user ${userId}`, { lockKey, lockValue });
      } catch (error) {
        logger.error(`Error releasing mutex for user ${userId}:`, error);
        throw error;
      }
    };
  }

  /**
   * Release a distributed mutex lock
   * @param lockKey - The lock key
   * @param lockValue - The lock value (must match to release)
   */
  private async releaseUserMutex(lockKey: string, lockValue: string): Promise<void> {
    // Use Lua script to atomically check and delete the lock
    // This prevents releasing a lock that was acquired by another process
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, lockKey, lockValue);
    
    if (result !== 1) {
      throw new Error(
        `Failed to release mutex: lock not found or value mismatch (key: ${lockKey})`
      );
    }
  }

  /**
   * Check if a user mutex is currently held
   * @param userId - The user ID to check
   * @returns True if the mutex is held, false otherwise
   */
  async isUserMutexHeld(userId: string): Promise<boolean> {
    const lockKey = `user_mutex:${userId}`;
    const result = await this.redis.exists(lockKey);
    return result === 1;
  }

  /**
   * Get the TTL (time to live) of a user mutex
   * @param userId - The user ID to check
   * @returns TTL in milliseconds, or -1 if not found, -2 if no expiry
   */
  async getUserMutexTTL(userId: string): Promise<number> {
    const lockKey = `user_mutex:${userId}`;
    const ttl = await this.redis.pttl(lockKey);
    return ttl;
  }

  /**
   * Force release a user mutex (use with caution)
   * @param userId - The user ID to force release
   */
  async forceReleaseUserMutex(userId: string): Promise<void> {
    const lockKey = `user_mutex:${userId}`;
    await this.redis.del(lockKey);
    logger.warn(`Force released mutex for user ${userId}`, { lockKey });
  }

  /**
   * Clean up orphaned mutexes (those that have expired but weren't properly released)
   * This is a maintenance function that can be called periodically
   */
  async cleanupOrphanedMutexes(): Promise<number> {
    const pattern = 'user_mutex:*';
    const keys = await this.redis.keys(pattern);
    let cleaned = 0;

    for (const key of keys) {
      const ttl = await this.redis.pttl(key);
      // If TTL is -1 (no expiry) or -2 (key doesn't exist), it's orphaned
      if (ttl === -1 || ttl === -2) {
        await this.redis.del(key);
        cleaned++;
        logger.warn(`Cleaned up orphaned mutex: ${key}`);
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} orphaned mutexes`);
    }

    return cleaned;
  }

  /**
   * Get statistics about active mutexes
   */
  async getMutexStats(): Promise<{
    totalMutexes: number;
    mutexes: Array<{ userId: string; ttl: number }>;
  }> {
    const pattern = 'user_mutex:*';
    const keys = await this.redis.keys(pattern);
    const mutexes = [];

    for (const key of keys) {
      const userId = key.replace('user_mutex:', '');
      const ttl = await this.redis.pttl(key);
      mutexes.push({ userId, ttl });
    }

    return {
      totalMutexes: mutexes.length,
      mutexes,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis mutex connection closed');
    }
  }
}
