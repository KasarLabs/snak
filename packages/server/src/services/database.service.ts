import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Postgres } from '@snakagent/database';
import { DatabaseConfigService } from '@snakagent/core';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performConnect();

    try {
      await this.initializationPromise;
    } catch (error) {
      this.initializationPromise = null;
      throw error;
    }
  }

  private async performConnect(): Promise<void> {
    try {
      this.logger.log('Initializing database connection...');

      // Ensure database configuration is initialized
      if (!DatabaseConfigService.getInstance().isInitialized()) {
        DatabaseConfigService.getInstance().initialize();
      }

      const databaseConfig = DatabaseConfigService.getInstance().getCredentials();
      await Postgres.connect(databaseConfig);

      this.initialized = true;
      this.logger.log('Database connection initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database connection:', error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      this.logger.log('Closing database connection...');
      await Postgres.shutdown();
      this.initialized = false;
      this.initializationPromise = null;
      this.logger.log('Database connection closed successfully');
    } catch (error) {
      this.logger.error('Failed to close database connection:', error);
      throw error;
    }
  }

  /**
   * Returns a promise that resolves when the database is fully initialized
   * @returns Promise<void> that resolves when initialization is complete
   */
  public async onReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    return this.connect();
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
