import { Postgres } from '../../database.js';
import { Id } from '../common.js';

// Singleton init pattern similar to other query modules
let initPromise: Promise<void> | null = null;
let isInitialized = false;

export namespace iterations {
  export async function init(): Promise<void> {
    if (isInitialized) return;
    if (initPromise) return await initPromise;
    initPromise = performInit();
    try {
      await initPromise;
      isInitialized = true;
    } finally {
      initPromise = null;
    }
  }

  async function performInit(): Promise<void> {
    const t = [
      new Postgres.Query(`CREATE EXTENSION IF NOT EXISTS vector;`),
      new Postgres.Query(`
        CREATE TABLE IF NOT EXISTS iterations(
          id SERIAL PRIMARY KEY,
          agent_id VARCHAR(100) NOT NULL,
          question TEXT NOT NULL,
          question_embedding vector(384) NOT NULL,
          answer TEXT NOT NULL,
          answer_embedding vector(384) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `),
      new Postgres.Query(
        `CREATE INDEX IF NOT EXISTS iterations_agent_id_idx ON iterations(agent_id);`
      ),
      new Postgres.Query(`ANALYZE iterations;`),
    ];
    await Postgres.transaction(t);
  }

  interface IterationBase {
    agent_id: string;
    question: string;
    question_embedding: number[];
    answer: string;
    answer_embedding: number[];
    created_at?: Date;
  }

  interface IterationWithId extends IterationBase {
    id: number;
  }

  export type Iteration<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? IterationWithId
    : IterationBase;

  export async function insert_iteration(iteration: Iteration): Promise<void> {
    const q = new Postgres.Query(
      `INSERT INTO iterations(agent_id, question, question_embedding, answer, answer_embedding, created_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP));`,
      [
        iteration.agent_id,
        iteration.question,
        JSON.stringify(iteration.question_embedding),
        iteration.answer,
        JSON.stringify(iteration.answer_embedding),
        iteration.created_at,
      ]
    );
    console.log("Agent id:", iteration.agent_id);
    console.log("question:", iteration.question);
    console.log("answer:", iteration.answer);
    await Postgres.query(q);
  }

  export async function select_iterations(
    agentId: string
  ): Promise<Iteration<Id.Id>[]> {
    const q = new Postgres.Query(
      `SELECT id, agent_id, question, question_embedding, answer, answer_embedding, created_at
       FROM iterations
       WHERE agent_id = $1
       ORDER BY id ASC;`,
      [agentId]
    );
    return await Postgres.query(q);
  }

  export async function delete_oldest_iteration(agentId: string): Promise<void> {
    const q = new Postgres.Query(
      `DELETE FROM iterations
         WHERE id = (
           SELECT id FROM iterations WHERE agent_id = $1 ORDER BY id ASC LIMIT 1
         );`,
      [agentId]
    );
    await Postgres.query(q);
  }

  export async function count_iterations(agentId: string): Promise<number> {
    const q = new Postgres.Query(
      `SELECT COUNT(*)::int AS count FROM iterations WHERE agent_id = $1`,
      [agentId]
    );
    const res = await Postgres.query<{ count: number }>(q);
    return res[0]?.count || 0;
  }
}