import { transaction, Query } from "../../database.js"
import { DatabaseError } from "../../error.js";

/**
 * @throws { DatabaseError }
 */
export async function init(): Promise<void> {
	const t = [
		new Query(
			`CREATE TABLE IF NOT EXISTS project(
				id SERIAL PRIMARY KEY,
				name VARCHAR(100) UNIQUE,
				type VARCHAR(50) CHECK (type in ('contract', 'cairo_program')),
				execution_trace BYTEA,
				proof JSONB,
				verified BOOLEAN DEFAULT FALSE
			);`
		),
		new Query(
			`CREATE TABLE IF NOT EXISTS program(
				id SERIAL PRIMARY KEY,
				project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
				name VARCHAR(255) NOT NULL,
				source_code TEXT,
				sierra JSONB,
				casm JSONB
			)`
		),
		new Query(
			`CREATE TABLE IF NOT EXISTS dependency(
				id SERIAL PRIMARY KEY,
				project_id INTEGER REFERENCES project(id) ON DELETE CASCADE,
				name VARCHAR(255) NOT NULL,
				version VARCHAR(50)
			)`
		)
	]
	await transaction(t);
}
