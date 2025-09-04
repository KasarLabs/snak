/**
 * Database-related types and interfaces
 */

/**
 * Database credentials structure
 */
export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

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
