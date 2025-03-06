import { Pool, QueryResult } from 'pg';
import { DEFAULT } from '../types/database.js';

/**
 * Represents a PostgreSQL database connection.
 * @property {string} name - Name of the database
 * @property {Pool} pool - Connection pool for the database
 */
export interface PostgresDatabase {
  name: string;
  pool: Pool;
}

/**
 * Options for inserting data into a PostgreSQL table.
 * @property {string} table_name - Name of the table to insert data into
 * @property {string} [ALIAS] - Optional alias for the table
 * @property {Map<string, string | number | DEFAULT>} fields - Map of field names to their values
 */
export interface insertOptionInterface {
  table_name: string;
  ALIAS?: string;
  fields: Map<string, string | number | DEFAULT>;
}

/**
 * Options for updating data in a PostgreSQL table.
 * @property {boolean} ONLY - Whether to update only the specified table (true) or also child tables (false)
 * @property {string} [ALIAS] - Optional alias for the table
 * @property {string[]} SET - Array of SET expressions defining values to update
 * @property {string[]} [FROM] - Optional FROM clause elements
 * @property {string[]} [WHERE] - Optional WHERE conditions
 */
export interface updateOptionInterface {
  ONLY: boolean;
  ALIAS?: string;
  SET: string[];
  FROM?: string[];
  WHERE?: string[];
}

/**
 * Options for deleting data from a PostgreSQL table.
 * @property {string} table_name - Name of the table to delete data from
 * @property {boolean} ONLY - Whether to delete only from the specified table (true) or also child tables (false)
 * @property {string} [ALIAS] - Optional alias for the table
 * @property {string[]} [USING] - Optional USING clause elements
 * @property {string[]} [WHERE] - Optional WHERE conditions
 */
export interface deleteOptionInterface {
  table_name: string;
  ONLY: boolean;
  ALIAS?: string;
  USING?: string[];
  WHERE?: string[];
}

/**
 * Options for selecting data from PostgreSQL tables.
 * @property {string[]} FROM - Array of table names to select from
 * @property {string} [ALIAS] - Optional alias for the main table
 * @property {string[]} SELECT - Array of expressions to select
 * @property {string[]} [WHERE] - Optional WHERE conditions
 */
export interface selectOptionInterface {
  FROM: string[];
  ALIAS?: string;
  SELECT: string[];
  WHERE?: string[];
}

/**
 * Configuration for a PostgreSQL database connection pool.
 * @property {string} host - Database server hostname
 * @property {string} user - Username for authentication
 * @property {string} password - Password for authentication
 * @property {string} database - Database name
 * @property {number} port - Port number for the connection
 */
export interface PostgresDatabasePoolInterface {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
}

/**
 * Options for creating a PostgreSQL table.
 * @property {string} table_name - Name of the table to create
 * @property {string} [schema] - Optional schema name for the table
 * @property {boolean} [if_not_exist] - Whether to use IF NOT EXISTS in the creation statement
 * @property {Map<string, string>} fields - Map of field names to their data types
 */
export interface PostgresTables {
  table_name: string;
  schema?: string;
  if_not_exist?: boolean;
  fields: Map<string, string>;
}

/**
 * Options for creating a PostgreSQL schema.
 * @property {string} name - Name of the schema to create
 * @property {boolean} [if_not_exist] - Whether to use IF NOT EXISTS in the creation statement
 * @property {string} [authorization] - Optional role that will own the schema
 */
export interface PostgresSchema {
  name: string;
  if_not_exist?: boolean;
  authorization?: string;
}

/**
 * Options for dropping a PostgreSQL schema.
 * @property {string} schema_name - Name of the schema to drop
 * @property {boolean} [if_exists] - Whether to use IF EXISTS in the drop statement
 * @property {boolean} [cascade] - Whether to drop all objects in the schema as well
 * @property {boolean} [restrict] - Whether to refuse to drop if objects still exist in the schema
 */
export interface dropSchemaOptionInterface {
  schema_name: string;
  if_exists?: boolean;
  cascade?: boolean;
  restrict?: boolean;
}

/**
 * Options for dropping a PostgreSQL table.
 * @property {string} table_name - Name of the table to drop
 * @property {string} [schema_name] - Optional schema name containing the table
 * @property {boolean} [if_exists] - Whether to use IF EXISTS in the drop statement
 * @property {boolean} [cascade] - Whether to automatically drop objects that depend on the table
 * @property {boolean} [restrict] - Whether to refuse to drop if objects depend on the table
 */
export interface dropTableOptionInterface {
  table_name: string;
  schema_name?: string;
  if_exists?: boolean;
  cascade?: boolean;
  restrict?: boolean;
}

export interface QueryResponseInterface {
  status: 'success' | 'error';
  code: string;
  error_message?: string;
  query?: QueryResult;
}
