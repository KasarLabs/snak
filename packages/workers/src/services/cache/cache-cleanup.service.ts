
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from './cache.service.js';
import { logger } from '@snakagent/core';

@Injectable()
export class CacheCleanupService implements OnModuleInit, OnModuleDestroy {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private readonly cacheService: CacheService) {}

  async onModuleInit() {
    this.startAutomaticCleanup();
    logger.info('Cache cleanup service initialized');
  }

  async onModuleDestroy() {
    this.stopAutomaticCleanup();
    logger.info('Cache cleanup service destroyed');
  }

  private startAutomaticCleanup() {
    if (this.cleanupInterval) {
      return;
    }

    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, 60 * 60 * 1000);

    logger.info('Automatic cache cleanup started (every hour)');
  }

  private stopAutomaticCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Automatic cache cleanup stopped');
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performCleanup(): Promise<void> {
    if (this.isRunning) {
      logger.debug('Cache cleanup already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting cache cleanup...');
      const cleanedCount = await this.cacheService.cleanupExpired();
      
      const duration = Date.now() - startTime;
      logger.info(`Cache cleanup completed in ${duration}ms, cleaned ${cleanedCount} entries`);
    } catch (error) {
      logger.error('Cache cleanup failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async forceCleanup(): Promise<{ cleanedCount: number; duration: number }> {
    if (this.isRunning) {
      logger.warn('Cache cleanup already running; skipping forced run.');
      return { cleanedCount: 0, duration: 0 };
    }
    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      logger.info('Force cache cleanup started...');
      const cleanedCount = await this.cacheService.cleanupExpired();
      const duration = Date.now() - startTime;
      
      logger.info(`Force cache cleanup completed in ${duration}ms, cleaned ${cleanedCount} entries`);
      return { cleanedCount, duration };
    } catch (error) {
      logger.error('Force cache cleanup failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async getCacheStats() {
    return await this.cacheService.getCacheStats();
  }

  async flushCache(): Promise<void> {
    try {
      logger.info('Flushing entire cache...');
      await this.cacheService.flushAll();
      logger.info('Cache flushed successfully');
    } catch (error) {
      logger.error('Failed to flush cache:', error);
      throw error;
    }
  }
}
