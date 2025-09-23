/**
 * Handles database logic and connections in a safe way, that is to say special
 * precautions are take to avoid common issues such as starving the shared pool
 * pool of clients or accessing query results in a way that is not type-safe.
 *
 * This will automatically connect to the local database based on the following
 * env variables:
 *
 * ```
 * POSTGRES_USER=...
 * POSTGRES_HOST=...
 * POSTGRES_DB=...
 * POSTGRES_PASSWORD=...
 * POSTGRES_PORT=...
 * ```
 *
 * Make sure they are part of your `.env` or you will be getting some strange
 * results!
 *
 * @module database
 * @packageDocumentation
 */

import pg, { PoolClient, QueryResult } from 'pg';
const { Pool } = pg;

import { DatabaseError } from './error.js';

/**
 * We rely on the default postgress environment variables to establish a
 * connection.
 *
 * @see module:database
 */

export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export namespace Postgres {
  /**
   * A query and its associated values.
   *
   * > [!CAUTION]
   * > **DO NOT** directly interpolate values into a query string, as this can
   * > lead to SQL injections! Instead, reference these using the `$` syntax.
   *
   * ```ts
   * const query = new Query("SELECT name from users WHERE id = $1", [userId]);
   * ```
   */
  export class Query {
    public readonly query: string;
    public readonly values?: any[];

    public constructor(query: string, values?: any[]) {
      this.query = query;
      this.values = values;
    }
  }

  /**
   * Creates a new connection pool. Shutting down the previous one if it was
   * still active.
   *
   * > This is mostly intended for use in setup/teardown logic between tests.
   */
  export async function connect(db: DatabaseCredentials): Promise<void> {
    // await shutdown();

    if (this.pool != undefined) {
      return;
    }
    this.pool = new Pool({
      user: db.user,
      host: db.host,
      database: db.database,
      password: db.password,
      port: db.port,
    });

    this.pool.on('error', (err: any) => {
      console.error('something bad has happened!', err.stack);
    });
  }

  /**
   * Performs a query against the locally configured database.
   *
   * @throws { DatabaseError }
   * @see module:database
   */
  export async function query<Model = Record<string, unknown>>(
    q: Query
  ): Promise<Model[]> {
    try {
      if (!this.pool) {
        throw new Error('Connection pool not initialized! query');
      }
      const query = await this.pool.query(q.query, q.values);
      return query.rows;
    } catch (err: any) {
      throw DatabaseError.handlePgError(err);
    }
  }

  /**
   * Performs a single [ACID](https://en.wikipedia.org/wiki/ACID) transaction
   * against the locally configured database.
   *
   * @throws { DatabaseError }
   * @see module:database
   */
  export async function transaction<Model = Record<string, unknown>>(
    qs: Query[]
  ): Promise<Model[]> {
    let client: PoolClient | undefined;
    let res: QueryResult | undefined;
    try {
      if (!this.pool) {
        throw new Error('Connection pool not initialized!transaction');
      }
      client = await this.pool.connect();
      if (!client) {
        throw new Error('Failed to acquire a client from the pool');
      }
      await client.query('BEGIN;');
      for (const q of qs) {
        res = await client.query(q.query, q.values);
      }
      await client.query('COMMIT;');

      return res ? res.rows : [];
    } catch (err: any) {
      throw DatabaseError.handlePgError(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Closes the connection pool.
   *
   * > [!CAUTION]
   * > This method must imperatively be called at the end of the app's lifetime
   * > or else we risk starving the database of connections overtime! **New calls
   * > to the database can no longer be made once the connection pool has been
   * > closed**.
   */
  export async function shutdown(): Promise<void> {
    try {
      if (this.pool) {
        const poolToEnd = this.pool;
        this.pool = undefined;
        await poolToEnd.end();
      }
    } catch (err: any) {
      throw DatabaseError.handlePgError(err);
    }
  }
}

/**
 * Singleton class for managing LangGraph schema database connections
 * Provides a dedicated connection pool for the langgraph schema
 */
export class LanggraphDatabase {
  private static instance: LanggraphDatabase;
  private pool: pg.Pool | undefined;

  private constructor() {}

  /**
   * Gets the singleton instance of LanggraphDatabase
   */
  public static getInstance(): LanggraphDatabase {
    if (!LanggraphDatabase.instance) {
      LanggraphDatabase.instance = new LanggraphDatabase();
    }
    return LanggraphDatabase.instance;
  }

  /**
   * Connects to the database with langgraph schema as default search path
   */
  public async connect(credentials: DatabaseCredentials): Promise<void> {
    if (this.pool) {
      return;
    }
    console.log('Connecting to LangGraph database...');
    console.log(credentials);

    this.pool = new Pool({
      user: credentials.user,
      host: credentials.host,
      database: credentials.database,
      password: credentials.password,
      port: credentials.port,
    });

    this.pool.on('error', (err: any) => {
      console.error('LangGraph database pool error:', err.stack);
    });
    console.log('Connected to LangGraph database');
  }

  /**
   * Executes a query against the langgraph schema
   */
  public async query<Model = Record<string, unknown>>(
    q: Postgres.Query
  ): Promise<Model[]> {
    try {
      if (!this.pool) {
        throw new Error('LangGraph database pool not initialized!');
      }
      const result = await this.pool.query(q.query, q.values);
      return result.rows;
    } catch (err: any) {
      throw DatabaseError.handlePgError(err);
    }
  }

  /**
   * Executes a transaction against the langgraph schema
   */
  public async transaction<Model = Record<string, unknown>>(
    queries: Postgres.Query[]
  ): Promise<Model[]> {
    let client: PoolClient | undefined;
    let result: QueryResult | undefined;

    try {
      if (!this.pool) {
        throw new Error('LangGraph database pool not initialized!');
      }

      client = await this.pool.connect();
      if (!client) {
        throw new Error('Failed to acquire client from LangGraph pool');
      }

      await client.query('BEGIN;');
      for (const q of queries) {
        result = await client.query(q.query, q.values);
      }
      await client.query('COMMIT;');

      return result ? result.rows : [];
    } catch (err: any) {
      if (client) {
        await client.query('ROLLBACK;');
      }
      throw DatabaseError.handlePgError(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Closes the LangGraph database connection pool
   */
  public async shutdown(): Promise<void> {
    try {
      if (this.pool) {
        const poolToEnd = this.pool;
        this.pool = undefined;
        await poolToEnd.end();
      }
    } catch (err: any) {
      throw DatabaseError.handlePgError(err);
    }
  }

  /**
   * Gets the current pool instance (for advanced usage)
   */
  public getPool(): pg.Pool | undefined {
    return this.pool;
  }
}
