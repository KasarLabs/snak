import { Postgres } from '../../database.js';
import { Id } from '../common.js';
import { DatabaseError } from '../../error.js';

export namespace chat {
  /**
   * Initializes the chat-pool table.
   *
   * @throws { DatabaseError }
   */
  export async function init(): Promise<void> {
    const q = new Postgres.Query(
      `CREATE TABLE IF NOT EXISTS sak_table_chat(
        id SERIAL PRIMARY KEY,
        instruction VARCHAR(255) NOT NULL
      )`
    );
    await Postgres.query(q);
  }

  interface InstructionBase {
    instruction: string;
  }
  interface InstructionWithId extends InstructionBase {
    id: Id;
  }

  /**
   * An instruction given to the agent.
   *
   * @field { number } [id] - Instruction id in db (optional).
   * @field { string } Instruction - The actual instruction.
   */
  export type Instruction<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? InstructionWithId
    : InstructionBase;

  /**
   * Inserts a { @see Instruction } into the database.
   *
   * @param { string } instruction - Instruction to insert.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function insert_instruction(instruction: string): Promise<void> {
    const q = new Postgres.Query(
      `INSERT INTO sak_table_chat(instruction) VALUES($1); `,
      [instruction]
    );
    await Postgres.query(q);
  }

  /**
   * Retrieves all the { @see Instruction } currently stored in the database.
   *
   * > [!WARNING]
   * > This is probably not a good idea and should be replace by a proper
   * > cursor asap.
   *
   * @returns { Instruction[] } All instructions currently stored in db.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function select_instructions(): Promise<Instruction<Id.Id>[]> {
    const q = new Postgres.Query(`SELECT id, instruction FROM sak_table_chat; `);
    return await Postgres.query(q);
  }
}
