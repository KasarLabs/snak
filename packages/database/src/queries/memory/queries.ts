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

  export interface Metadata {
    created_at?: string;
    updated_at: string;
    access_count?: number;
    confidence?: number;
    category?: string;
  }

  export interface UPSERT_SEMANTIC_MEMORY_OUTPUT {
    memory_id: number;
    task_id: string;
    step_id: string;
    operation: string;
    similarity_score: number | null;
    matched_fact: string | null;
  }

  export interface INSERT_EPISODIC_MEMORY_OUTPUT {
    memory_id: number;
    task_id: string;
    step_id: string;
    operation: string;
    similar_memory_id: number | null;
    similar_memory_content: string | null;
  }

  export interface History {
    value: string;
    timestamp: string;
    action: 'UPDATE';
  }
  interface MemoryBase {
    user_id: string;
    run_id: string;
    task_id: string;
    step_id: string;
    embedding: number[];
    created_at?: Date;
    accessed_at?: Date;
    confidence?: number;
    access_count?: number;
  }

  interface EpisodicMemoryBase extends MemoryBase {
    content: string;
    sources: Array<string>;
    expires_at?: Date;
  }

  interface SemanticMemoryBase extends MemoryBase {
    fact: string;
    category: string;
    source_events?: Array<number>;
  }
  interface MemoryWithId extends MemoryBase {
    id: number;
  }

  interface SemanticMemoryWithId extends SemanticMemoryBase {
    id: number;
  }
  interface EpisodicMemoryWithId extends EpisodicMemoryBase {
    id: number;
  }

  /**
   * A Memory of an action which the agent is aware of.
   */
  export type Memory<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? MemoryWithId
    : MemoryBase;

  export type EpisodicMemory<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? EpisodicMemoryWithId
    : EpisodicMemoryBase;

  export type SemanticMemory<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? SemanticMemoryWithId
    : SemanticMemoryBase;

  export async function insert_episodic_memory(
    memory: EpisodicMemory
  ): Promise<INSERT_EPISODIC_MEMORY_OUTPUT> {
    const q = new Postgres.Query(
      `SELECT * FROM insert_episodic_memory_smart($1, $2, $3, $4, $5, $6, $7);`,
      [
        memory.user_id,
        memory.run_id,
        memory.task_id,
        memory.step_id,
        memory.content,
        JSON.stringify(memory.embedding),
        memory.sources,
      ]
    );
    const result = await Postgres.query<INSERT_EPISODIC_MEMORY_OUTPUT>(q);
    return result[0];
  }

  export async function insert_semantic_memory(
    memory: SemanticMemory
  ): Promise<UPSERT_SEMANTIC_MEMORY_OUTPUT> {
    const q = new Postgres.Query(
      `SELECT * FROM upsert_semantic_memory_smart($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        memory.user_id,
        memory.run_id,
        memory.task_id,
        memory.step_id,
        memory.fact,
        JSON.stringify(memory.embedding),
        memory.category,
        memory.source_events,
      ]
    );
    const result = await Postgres.query<UPSERT_SEMANTIC_MEMORY_OUTPUT>(q);
    return result[0];
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
    memory_type: string;
    memory_id: number;
    task_id: string;
    step_id: string;
    content: string;
    similarity: number;
    metadata: any; // JSONB from PostgreSQL
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
    runId: string,
    embedding: number[],
    limit?: number,
    threshold?: number
  ): Promise<Similarity[]> {
    const q = new Postgres.Query(
      `SELECT * FROM retrieve_similar_memories($1, $2, $3, $4, $5)`,
      [userId, runId, JSON.stringify(embedding), threshold || 0, limit || 10]
    );
    const result = await Postgres.query<Similarity>(q);
    return result;
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
         OFFSET $2~
       );`,
      [userId, limit]
    );
    await Postgres.query(q);
  }
}
