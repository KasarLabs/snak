/**
 * Cache service for workers package
 * Provides caching functionality for job results and metadata
 */

import { Injectable } from '@nestjs/common';
import { logger } from '@snakagent/core';
import { JobRetrievalResult } from '../../types/jobs.js';

type CacheEntry = {
  result: JobRetrievalResult;
  expiresAt: number | null;
  timer?: ReturnType<typeof setTimeout>;
};

@Injectable()
export class CacheService {
  private static readonly MAX_TIMEOUT_MS = 2_147_483_647;
  private cache = new Map<string, CacheEntry>();

  /**
   * Set a job retrieval result in cache
   */
  async setJobRetrievalResult(
    key: string,
    result: JobRetrievalResult,
    ttlMs?: number
  ): Promise<void> {
    try {
      const cacheKey = `job-result:${key}`;
      const existing = this.cache.get(cacheKey) as CacheEntry | undefined;
      if (existing?.timer) clearTimeout(existing.timer);

      const hasTtl = Number.isFinite(ttlMs) && (ttlMs as number) > 0;
      const expiresAt = hasTtl ? Date.now() + (ttlMs as number) : null;
      const timer = hasTtl
        ? this.scheduleEviction(cacheKey, expiresAt as number)
        : undefined;

      this.cache.set(cacheKey, { result, expiresAt, timer });

      logger.debug(`Cached job result for key: ${key}`);
    } catch (error) {
      logger.error(`Failed to cache job result for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a job retrieval result from cache
   */
  async getJobRetrievalResult(key: string): Promise<JobRetrievalResult | null> {
    try {
      const cacheKey = `job-result:${key}`;
      const data = this.cache.get(cacheKey) as CacheEntry | undefined;

      if (!data) {
        return null;
      }

      if (data.expiresAt !== null && Date.now() >= data.expiresAt) {
        if (data.timer) clearTimeout(data.timer);
        this.cache.delete(cacheKey);
        return null;
      }

      logger.debug(`Retrieved job result from cache for key: ${key}`);
      return data.result;
    } catch (error) {
      logger.error(
        `Failed to get job result from cache for key ${key}:`,
        error
      );
      return null;
    }
  }

  /**
   * Delete a job retrieval result from cache
   */
  async deleteJobRetrievalResult(key: string): Promise<void> {
    try {
      const cacheKey = `job-result:${key}`;
      const existing = this.cache.get(cacheKey) as CacheEntry | undefined;
      if (existing?.timer) clearTimeout(existing.timer);
      this.cache.delete(cacheKey);
      logger.debug(`Deleted job result from cache for key: ${key}`);
    } catch (error) {
      logger.error(
        `Failed to delete job result from cache for key ${key}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  async clear(): Promise<void> {
    try {
      // Clear all timers before clearing the cache
      for (const data of this.cache.values()) {
        if (data.timer) clearTimeout(data.timer);
      }
      this.cache.clear();
      logger.debug('Cleared all cached data');
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      throw error;
    }
  }

  private scheduleEviction(
    cacheKey: string,
    targetTs: number
  ): ReturnType<typeof setTimeout> {
    const now = Date.now();
    const delay = Math.min(
      Math.max(0, targetTs - now),
      CacheService.MAX_TIMEOUT_MS
    );
    const t = setTimeout(() => {
      const entry = this.cache.get(cacheKey);
      if (!entry) return;
      if (entry.expiresAt !== targetTs) return;

      if (Date.now() >= targetTs) {
        this.cache.delete(cacheKey);
        return;
      }
      entry.timer = this.scheduleEviction(cacheKey, targetTs);
    }, delay);
    (t as any).unref?.();
    return t;
  }

  /**
   * Clean up expired entries from cache
   */
  async cleanupExpired(): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    for (const [key, data] of this.cache.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        if (data.timer) clearTimeout(data.timer);
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    return cleanedCount;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ size: number; keys: string[] }> {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Flush all cache entries
   */
  async flushAll(): Promise<void> {
    // Clear all timers before clearing the cache
    for (const data of this.cache.values()) {
      if (data.timer) clearTimeout(data.timer);
    }
    this.cache.clear();
    logger.debug('Flushed all cache entries');
  }
}
