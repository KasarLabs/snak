import { logger, DatabaseConfigService } from '@snakagent/core';
import { LanggraphDatabase, Postgres } from '@snakagent/database';

export class DatabaseStorage {
  connected: boolean;

  constructor() {
    this.connected = false;
  }

  public async connect() {
    try {
      if (this.connected) {
        return;
      }

      // Ensure database configuration is initialized
      if (!DatabaseConfigService.getInstance().isInitialized()) {
        DatabaseConfigService.getInstance().initialize();
      }

      const databaseConfig =
        DatabaseConfigService.getInstance().getCredentials();

      await Postgres.connect(databaseConfig);
      try {
        await LanggraphDatabase.getInstance().connect(databaseConfig);
      } catch (error) {
        logger.error('Error connecting to the Langgraph database:', error);
        await Postgres.shutdown();
        throw error;
      }
      this.connected = true;
      logger.info('Connected to the database');
    } catch (error) {
      logger.error('Error connecting to the database:', error);
      throw error;
    }
  }
}

export default new DatabaseStorage();
