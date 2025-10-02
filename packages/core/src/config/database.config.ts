import { DatabaseCredentials } from '../common/agent.js';

/**
 * Global database configuration service
 * Centralizes database configuration to avoid duplication across the codebase
 */
export class DatabaseConfigService {
  private static instance: DatabaseConfigService;
  private databaseCredentials: DatabaseCredentials | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of DatabaseConfigService
   */
  public static getInstance(): DatabaseConfigService {
    if (!DatabaseConfigService.instance) {
      DatabaseConfigService.instance = new DatabaseConfigService();
    }
    return DatabaseConfigService.instance;
  }

  /**
   * Initialize database credentials from environment variables
   * This should be called once during application startup
   */
  public initialize(): void {
    if (this.databaseCredentials) {
      return; // Already initialized
    }

    this.databaseCredentials = {
      database: process.env.POSTGRES_DB as string,
      host: process.env.POSTGRES_HOST as string,
      user: process.env.POSTGRES_USER as string,
      password: process.env.POSTGRES_PASSWORD as string,
      port: parseInt(process.env.POSTGRES_PORT as string),
    };
  }

  /**
   * Get the database credentials
   * @returns DatabaseCredentials object
   * @throws Error if not initialized
   */
  public getCredentials(): DatabaseCredentials {
    if (!this.databaseCredentials) {
      throw new Error('DatabaseConfigService not initialized. Call initialize() first.');
    }
    return this.databaseCredentials;
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.databaseCredentials !== null;
  }
}
