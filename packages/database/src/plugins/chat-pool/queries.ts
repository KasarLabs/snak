import { query, Query } from "../../database.js"
import { DatabaseError } from "../../error.js";

/**
 * Initializes the chat-poo table.
 *
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

export interface SchemaInstruction {
	instruction: string
};

/**
 * Inserts a { @see SchemaInstruction } into the database.
 *
 * @param instruction - Instruction to insert.
 * @throws { DatabaseError }
 */
export async function insert_instruction(instruction: string): Promise<void> {
	const q = new Query(
		`INSERT INTO sak_table_chat(instruction) VALUES ($1);`,
		[instruction]
	);
	await query(q);
}

/**
 * Retrieves all the { @see SchemaInstruction } currently stored in the database.
 *
 * @returns An array of all instructions.
 * @throws { DatabaseError }
 */
export async function select_instruction(): Promise<SchemaInstruction[] | undefined> {
	const q = new Query(`SELECT instruction FROM sak_table_chat;`);
	return await query<{ instruction: string }>(q);
}
