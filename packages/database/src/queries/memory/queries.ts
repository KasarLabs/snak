import { Postgres } from '../../database.js';
import { Id } from '../common.js';
import pg from 'pg';

// Global lock to prevent concurrent initialization
let initPromise: Promise<void> | null = null;
let isInitialized = false;

export namespace memory {
  /**
   * Initializes the { @see Memory } table and some helper functions.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function init() {
    // Return immediately if already initialized
    if (isInitialized) {
      return;
    }

    // If initialization is already in progress, wait for it to complete
    if (initPromise) {
      return await initPromise;
    }

    // Start initialization and store the promise
    initPromise = performInit();

    try {
      await initPromise;
      isInitialized = true;
    } catch (error) {
      // Reset on failure so we can retry
      initPromise = null;
      throw error;
    }
  }

  /**
   * Performs the actual initialization
   */
  async function performInit(): Promise<void> {
    const q = new Postgres.Query(`SELECT 'vector'::regtype::oid;`);
    const oid = (await Postgres.query<{ oid: number }>(q))[0].oid;
    pg.types.setTypeParser(oid, (v: any) => {
      return JSON.parse(v) as number[];
    });
  }

  // TODO: The current memory setup does not really make sense. It would be
  // better to have something like
  //
  // ```sql
  // CREATE TABLE IF NOT EXISTS memories(
  //   id SERIAL PRIMARY KEY,
  //   user_id VARCHAR(100) NOT NULL,
  //   embedding vector(384) NOT NULL,
  // );
  //
  // CREATE TABLE IF NOT EXISTS history(
  //   id SERIAL PRIMARY KEY,
  //   memory_id INTEGER NOT NULL,
  //   content TEXT NOT NULL,
  //   created_ad TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  //   FOREIGN KEY (memory_id) REFERENCES memories(id)
  // );
  // ```
  //
  // Where we can get `updated_at` using:
  //
  // ```sql
  // SELECT created_at FROM history WHERE memory_id = $1 ORDER BY id DESC TAKE 1;
  // ```
  //
  // And `created_at` by using:
  //
  // ```sql
  // SELECT created_at FROM history WHERE memory_id = $1 ORDER BY id ASC TAKE 1;
  // ```
  export interface Metadata {
    timestamp: string;
    upsertedAt: number;
  }

  export interface History {
    value: string;
    timestamp: string;
    action: 'UPDATE';
  }

  interface MemoryBase {
    user_id: string;
    memories_id: string;
    query: string;
    content: string;
    embedding: number[];
    created_at?: Date;
    updated_at?: Date;
    metadata: Metadata;
    history: History[];
  }
  interface MemoryWithId extends MemoryBase {
    id: number;
  }

  /**
   * A Memory of an action which the agent is aware of.
   */
  export type Memory<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? MemoryWithId
    : MemoryBase;

  /**
   * Saves a new agent { @see Memory } into the db.
   *
   * @param { Memory } memory - The memory to insert.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function insert_memory(memory: Memory): Promise<void> {
    const q = new Postgres.Query(
      `SELECT insert_memory(null, $1, $2, $3, $4, $5, $6, $7, $8, $9);`,
      [
        memory.user_id,
        memory.memories_id || null, // Ajout
        memory.query || memory.content, // Ajout (ou utilisez le content si pas de query)
        memory.content,
        JSON.stringify(memory.embedding),
        memory.created_at,
        memory.updated_at,
        JSON.stringify(memory.metadata),
        JSON.stringify(memory.history),
      ]
    );
    ~(await Postgres.query(q));
  }

  /**
   * Retrieves a { @see Memory } by id from the db, if it exists.
   *
   * @param { number } id - Memory id.
   *
   * @returns { Memory<Id.Id> | undefined } Memory at the given id.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function select_memory(
    id: number
  ): Promise<Memory<Id.Id> | undefined> {
    const q = new Postgres.Query(`SELECT * FROM select_memory($1)`, [id]);
    const q_res = await Postgres.query<Memory<Id.Id>>(q);
    return q_res ? q_res[0] : undefined;
  }

  /**
   * Updates an existing { @see Memory } in the db.
   *
   * The `content`, `embedding`, `updated_at` and `history` are updated on
   * duplicate id. If a memory does not already exist at that id, it will be
   * created.
   *
   * @param { number } id - The id of the memory to update.
   * @param { string } content - The content of the new memory.
   * @param { number[] } embedding - Vector-encoded memory.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function update_memory(
    id: number,
    content: string,
    embedding: number[]
  ): Promise<void> {
    const q = new Postgres.Query(`SELECT update_memory($1, $2, $3);`, [
      id,
      content,
      JSON.stringify(embedding),
    ]);
    await Postgres.query(q);
  }

  /**
   * A { @see Memory } which is similar to another one. Similarity is
   * calculated based on the cosine distance between memory embeddings.
   *
   * https://github.com/pgvector/pgvector?tab=readme-ov-file#distances
   */
  export interface Similarity {
    id: number;
    query: string;
    content: string;
    history: History[];
    similarity: number;
  }

  export interface EpisodicMemory {
    id: number;
    content: string;
    similarity: number;
    importance: number;
    event_type: string;
    created_at: Date;
  }

  export interface SemanticKnowledge {
    id: string;
    concept: string;
    content: string;
    category: string;
    confidence: number;
    similarity: number;
  }

  /**
   * Retrieves the 4 most similar user memories to a given embedding.
   *
   * @param { string } userId - User the memories are associated to.
   * @param { number[] } embedding - Memory vector embedding.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function similar_memory(
    userId: string,
    embedding: number[],
    limit = 4
  ): Promise<Similarity[]> {
    const q = new Postgres.Query(
      `SELECT id, content, history, 1 - (embedding <=> $1::vector) AS similarity
          FROM agent_memories
          WHERE user_id = $2
          ORDER BY similarity DESC
          LIMIT $3;`,
      [JSON.stringify(embedding), userId, limit]
    );
    return await Postgres.query(q);
  }

  /**
   * Ensures a user has at most `limit` memories stored by deleting the oldest
   * entries beyond this limit.
   */
  export async function enforce_memory_limit(
    userId: string,
    limit: number
  ): Promise<void> {
    if (!limit || limit <= 0) return;
    const q = new Postgres.Query(
      `DELETE FROM agent_memories WHERE id IN (
         SELECT id FROM agent_memories
         WHERE user_id = $1
         ORDER BY created_at DESC
         OFFSET $2
       );`,
      [userId, limit]
    );
    await Postgres.query(q);
  }
}
