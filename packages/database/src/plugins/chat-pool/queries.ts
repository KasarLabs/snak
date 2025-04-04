import { query, Query } from "../../database.js"
import { DatabaseError } from "../../error.js";

/**
 * @throws { DatabaseError }
 */
export async function init(): Promise<void> {
	const q = new Query(
		`CREATE TABLE IF NOT EXISTS sak_table_chat(
			id SERIAL PRIMARY KEY,
			instruction VARCHAR(255) NOT NULL
		)`
	);
	await query(q);
}
