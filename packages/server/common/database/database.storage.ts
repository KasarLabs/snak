import { logger } from '@snakagent/core';
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
      await Postgres.connect({
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      });
      await LanggraphDatabase.getInstance().connect({
        database: process.env.POSTGRES_DB as string,
        host: process.env.POSTGRES_HOST as string,
        user: process.env.POSTGRES_USER as string,
        password: process.env.POSTGRES_PASSWORD as string,
        port: parseInt(process.env.POSTGRES_PORT as string),
      });
      this.connected = true;
      logger.info('Connected to the database');
    } catch (error) {
      logger.error('Error connecting to the database:', error);
      throw error;
    }
  }
}

export default new DatabaseStorage();
