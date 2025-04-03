/**
 * Handles database logic and connections in a safe way, that is to say special
 * precautions are take to avoid common issues such as starving the shared pool
 * pool of clients or accessing query results in a way that is not type-safe.
 *
 * This will automatically connect to the local database based on the following
 * env variables:
 *
 * ```
 * PGUSER=...
 * PGPASSWORD=...
 * PGDATABASE=...
 * PGHOST=...
 * PGPORT=...
 * ```
 *
 * Make sure they are part of your `.env` or you will be getting some strange
 * results!
 *
 * @module database
 * @packageDocumentation
 */


import { Pool, PoolClient } from 'pg';

import { DatabaseError } from './error.js';

/**
 * We rely on the default postgress environment variables to establish a 
 * connection.
 *
 * @see module:database
 */
const pool = new Pool({
	// For some reason pg requires env of the form `PG_...` instead of 
	// `POSTGRES_...` which is what postgres expects???
	database: process.env.POSTGRES_DATABASE,
	port: Number(process.env.POSTGRES_PORT),
	host: process.env.POSTGRES_HOST,
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD
});

console.log(`pwd: ${process.env.POSTGRES_PASSWORD}`);

pool.on('error', (err) => {
	console.error('something bad has happened!', err.stack)
})

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
	public readonly values?: string[];

	public constructor(query: string, values?: string[]) {
		this.query = query;
		this.values = values;
	}
}

/**
 * Performs a query against the locally configured database.
 *
 * @throws { DatabaseError }
 * @see module:database
 */
export async function query<Model>(q: Query): Promise<Model | undefined> {
	try {
		const query = await pool.query(q.query, q.values);
		return query.rows[0];
	} catch (err: any) {
		DatabaseError.handlePgError(err);
	}
}

/**
 * Performs a single [ACID](https://en.wikipedia.org/wiki/ACID) transaction 
 * against the locally configured database.
 *
 * @throws { DatabaseError }
 * @see module:database
 */
export async function transaction(qs: Query[]): Promise<void> {
	let client: PoolClient | undefined;
	try {
		client = await pool.connect();

		await client.query('BEGIN');
		for (const q of qs) {
			await client.query(q.query, q.values);
		}
		await client.query('COMMIT');

	} catch (err: any) {
		DatabaseError.handlePgError(err);
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
 * > This method must imperatively be called at the end of the app's lifetime or
 * > else we risk starving the database of connections overtime!
 */
export async function shutdown(): Promise<void> {
	try {
		await pool.end();
	} catch (err: any) {
		DatabaseError.handlePgError(err);
	}
}
