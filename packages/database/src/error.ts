import { DatabaseError as PgError } from "pg";

export class DatabaseError extends Error {
	code?: string;
	detail?: string;
	table?: string;

	public constructor(message: string, error?: PgError) {
		if (error) {
			super(`${message}: ${error.message}`);
		} else {
			super(message);
		}

		if (error) {
			this.code = error.code;
			this.detail = error.detail;
			this.table = error.table;
		}
	}

	/**
	 * Handles a { @see PgError } associated to a database query, logging some
	 * extra information in the process.
	 *
	 * @throws { DatabaseError }
	 */
	public static handlePgError(err: PgError): DatabaseError {
		// See https://www.postgresql.org/docs/current/errcodes-appendix.html
		switch (err.code) {
			case '23505': // unique_violation
				return new DatabaseError('Duplicate key violation', err);

			case '23503': // foreign_key_violation
				return new DatabaseError('Referenced record does not exist', err);

			case '28P01': // invalid_password
				return new DatabaseError('Database authentication failed', err);

			case '57P01': // admin_shutdown
			case '57P02': // crash_shutdown
			case '57P03': // cannot_connect_now
				return new DatabaseError('Database server unavailable', err);

			case '42P01': // undefined_table
				return new DatabaseError('Schema error: table not found', err);

			case '42P07': // duplicate_table
				return new DatabaseError('Table already exists', err);

			case '42501': // insufficient_privilege
				return new DatabaseError('Insufficient database privileges', err);

			case '42601': // syntax error
				return new DatabaseError('Syntax error', err);

			case '42703': // undefined_column
				return new DatabaseError('Schema error: column not found', err);

			default:
				return new DatabaseError('Database operation failed', err);
		}
	}
}
