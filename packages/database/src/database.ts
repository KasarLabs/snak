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
import { DatabaseCredentials } from './utils/database.js';
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

export class Postgres {
  /**
   * We rely on the default postgress environment variables to establish a
   * connection.
   *
   * @see module:database
   */

  protected pool: pg.Pool | undefined = undefined;

  public constructor(db: DatabaseCredentials) {
    this.pool = new Pool({
      user: db.user,
      host: db.host,
      database: db.database,
      password: db.password,
      port: db.port,
    });
    this.pool.on('error', (err) => {
      console.error('something bad has happened!', err.stack);
    });
  }

  public async connect(
    user: string,
    host: string,
    database: string,
    password: string,
    port: number
  ): Promise<void> {
    await this.shutdown();

    this.pool = new Pool({
      user,
      host,
      database,
      password,
      port,
    });

    this.pool.on('error', (err) => {
      console.error('something bad has happened!', err.stack);
    });
  }

  /**
   * Performs a query against the loc!ally configured database.
   *
   * @throws { DatabaseError }
   * @see module:database
   */
  public async query<Model = {}>(q: Query): Promise<Model[]> {
    try {
      if (!this.pool) {
        throw new Error('Database not connected');
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
  public async transaction<Model = {}>(qs: Query[]): Promise<Model[]> {
    let client: PoolClient | undefined;
    let res: QueryResult | undefined;
    try {
      if (!this.pool) {
        throw new Error('Database not connected');
      }
      client = await this.pool.connect();

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
  public async shutdown(): Promise<void> {
    try {
      if (!this.pool) {
        throw new Error('Database not connected');
      }
      await this.pool.end();
    } catch (err: any) {
      throw DatabaseError.handlePgError(err);
    }
  }
}
