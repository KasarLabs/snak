/**
 * Redis client singleton for managing agent storage
 * Provides a centralized Redis connection for the database package
 */

import { Redis } from 'ioredis';
import { logger } from '@snakagent/core';

/**
 * Singleton class for managing Redis connections
 * Provides a dedicated connection for agent storage operations
 */
export class RedisClient {
  private static instance: RedisClient;
  private client: Redis | undefined;

  private constructor() {}

  /**
   * Gets the singleton instance of RedisClient
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Connects to Redis with the provided configuration
   */
  public async connect(config?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  }): Promise<void> {
    if (this.client && this.isConnected()) {
      logger.debug('Redis client already connected');
      return;
    }

    const redisConfig = config || {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    };

    // Security: Validate Redis authentication configuration
    if (!redisConfig.password || redisConfig.password.trim() === '') {
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
          'REDIS_PASSWORD not configured - using unauthenticated Redis connection. ' +
            'This is strongly discouraged outside of development environments.'
        );
      }
    }

    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      lazyConnect: true,
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.client.on('ready', () => {
      logger.info('Redis ready');
    });

    try {
      await this.client.connect();
      await this.validateAuthentication();
      logger.info('Redis connection established and authenticated');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.client = undefined;
      throw error;
    }
  }

  /**
   * Get the Redis client instance
   * @throws {Error} If Redis is not connected
   */
  public getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if Redis is connected
   */
  public isConnected(): boolean {
    return this.client ? this.client.status === 'ready' : false;
  }

  /**
   * Closes the Redis connection
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.client) {
        const clientToQuit = this.client;
        this.client = undefined;
        await clientToQuit.quit();
        logger.info('Redis disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting Redis:', error);
      throw error;
    }
  }

  /**
   * Validate Redis authentication by executing a test command
   * @private
   */
  private async validateAuthentication(): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    try {
      // Use PING command to validate authentication
      const response = await this.client.ping();
      if (response !== 'PONG') {
        throw new Error(`Unexpected Redis PING response: ${response}`);
      }
      logger.debug('Redis authentication validated successfully');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const authError = new Error(
        `Redis authentication failed. Please verify REDIS_PASSWORD is correct: ${errorMessage}`
      );
      logger.error('Redis authentication validation failed:', authError);
      throw authError;
    }
  }
}

// Export a convenience function to get the client
export const getRedisClient = (): Redis => {
  return RedisClient.getInstance().getClient();
};
