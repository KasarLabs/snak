import { DatabaseCredentials } from '@snakagent/core';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  credentials: DatabaseCredentials;
  poolSize?: number;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * Database query result
 */
export interface DatabaseQueryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rowCount?: number;
  executionTime?: number;
}
