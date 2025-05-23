import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Postgres } from '@snakagent/database';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private initialized = false;

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

    try {
      this.logger.log('Initializing database connection...');

      await Postgres.connect({
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      });

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
      this.logger.log('Database connection closed successfully');
    } catch (error) {
      this.logger.error('Failed to close database connection:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
