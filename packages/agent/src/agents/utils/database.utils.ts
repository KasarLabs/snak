import { DatabaseCredentials, logger } from '@snakagent/core';
import { iterations, memory, Postgres } from '@snakagent/database/queries';

let databaseConnectionPromise: Promise<void> | null = null;
let isConnected = false;
/**
 * Initializes database connection with singleton pattern to prevent duplicate connections
 * @param db - Database credentials for connection
 */
export const initializeDatabase = async (db: DatabaseCredentials) => {
  try {
    if (isConnected) {
      await memory.init();
      await iterations.init();
      logger.debug(
        'Agent memory table successfully initialized (connection exists)'
      );
      return;
    }

    if (databaseConnectionPromise) {
      await databaseConnectionPromise;
      await memory.init();
      await iterations.init();
      logger.debug(
        'Agent memory table successfully initialized (waited for connection)'
      );
      return;
    }

    databaseConnectionPromise = Postgres.connect(db);
    await databaseConnectionPromise;
    isConnected = true;

    await memory.init();
    await iterations.init();
    logger.debug('Agent memory table successfully created');
  } catch (error) {
    logger.error('Error creating memories table:', error);
    databaseConnectionPromise = null;
    isConnected = false;
    throw error;
  }
};
