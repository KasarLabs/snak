import { DatabaseCredentials } from '../../utils/database.js';
import { Postgres, Query } from '../../database.js';
import { DatabaseError } from '../../error.js';

export namespace chatPool {
  export interface Instruction {
    instruction: string;
  }
}

export class chatPoolQueries extends Postgres {
  constructor(credentials: DatabaseCredentials) {
    super(credentials);
  }
  /**
   * Initializes the chat-poo table.
   *
   * @throws { DatabaseError }
   */
  async init(): Promise<void> {
    const q = new Query(
      `CREATE TABLE IF NOT EXISTS sak_table_chat(
        id SERIAL PRIMARY KEY,
        instruction VARCHAR(255) NOT NULL
      )`
    );
    await this.query(q);
  }

  /**
   * Inserts a { @see Instruction } into the database.
   *
   * @param instruction - Instruction to insert.
   * @throws { DatabaseError }
   */
  async insert_instruction(instruction: string): Promise<void> {
    const q = new Query(
      `INSERT INTO sak_table_chat(instruction) VALUES ($1);`,
      [instruction]
    );
    await this.query(q);
  }

  /**
   * Retrieves all the { @see Instruction } currently stored in the database.
   *
   * @returns An array of all instructions.
   * @throws { DatabaseError }
   */
  async select_instructions(): Promise<chatPool.Instruction[]> {
    const q = new Query(`SELECT instruction FROM sak_table_chat;`);
    return await this.query<{ instruction: string }>(q);
  }
}
