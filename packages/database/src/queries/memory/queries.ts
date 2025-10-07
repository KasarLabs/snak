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
    memory_id: string;
    task_id: string;
    step_id: string;
    operation: string;
    similarity_score: number | null;
    matched_fact: string | null;
  }

  export interface INSERT_EPISODIC_MEMORY_OUTPUT {
    memory_id: string;
    task_id: string;
    step_id: string;
    operation: string;
    similar_memory_id: string | null;
    similar_memory_content: string | null;
  }

  export interface INSERT_HOLISTIC_MEMORY_OUTPUT {
    memory_id: string;
    operation: string;
    similarity_score: number | null;
  }

  export interface RETRIEVE_HOLISTIC_MEMORY_OUTPUT {
    memory_id: string;
    step_id: string;
    content: string;
    request: string;
    similarity: number;
    access_count: number;
    created_at: Date;
    updated_at: Date;
  }

  export interface History {
    value: string;
    timestamp: string;
    action: 'UPDATE';
  }
  interface MemoryBase {
    user_id: string;
    task_id: string;
    step_id: string;
    embedding: number[];
    created_at?: Date;
    accessed_at?: Date;
    confidence?: number;
    access_count?: number;
  }

  export enum HolisticMemoryEnumType {
    TOOL = 'tool',
    AI_REQUEST = 'ai_request',
    HUMAN_REQUEST = 'human_request',
    AI_RESPONSE = 'ai_response',
  }
  interface HolisticMemoryBase extends MemoryBase {
    request: string;
    content: string;
    type: HolisticMemoryEnumType;
  }
  interface EpisodicMemoryBase extends MemoryBase {
    content: string;
    sources: Array<string>;
    expires_at?: Date;
  }

  interface SemanticMemoryBase extends MemoryBase {
    fact: string;
    category: string;
    source_events?: Array<string>;
  }
  interface MemoryWithId extends MemoryBase {
    id: string;
  }

  interface SemanticMemoryWithId extends SemanticMemoryBase {
    id: string;
  }
  interface EpisodicMemoryWithId extends EpisodicMemoryBase {
    id: string;
  }
  interface HolisticMemoryWithId extends HolisticMemoryBase {
    id: string;
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

  export type HolisticMemory<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? HolisticMemoryWithId
    : HolisticMemoryBase;

  export async function insert_holistic_memory(
    memory: HolisticMemoryBase,
    similarityThreshold: number
  ): Promise<INSERT_HOLISTIC_MEMORY_OUTPUT> {
    const q = new Postgres.Query(
      `SELECT * FROM insert_holistic_memory_smart($1, $2, $3, $4, $5, $6, $7,$8);`,
      [
        memory.user_id,
        memory.task_id,
        memory.step_id,
        memory.type,
        memory.content,
        JSON.stringify(memory.embedding),
        memory.request,
        similarityThreshold, // Default similarity threshold for holistic memories
      ]
    );
    const result = await Postgres.query<INSERT_HOLISTIC_MEMORY_OUTPUT>(q);
    return result[0];
  }

  export async function insert_episodic_memory(
    memory: EpisodicMemory,
    simitlarityThreshold: number
  ): Promise<INSERT_EPISODIC_MEMORY_OUTPUT> {
    const q = new Postgres.Query(
      `SELECT * FROM insert_episodic_memory_smart($1, $2, $3, $4, $5, $6, $7);`,
      [
        memory.user_id,
        memory.task_id,
        memory.step_id,
        memory.content,
        JSON.stringify(memory.embedding),
        simitlarityThreshold,
        memory.sources,
      ]
    );
    const result = await Postgres.query<INSERT_EPISODIC_MEMORY_OUTPUT>(q);
    return result[0];
  }

  export async function insert_semantic_memory(
    memory: SemanticMemory,
    similarityThreshold: number
  ): Promise<UPSERT_SEMANTIC_MEMORY_OUTPUT> {
    const q = new Postgres.Query(
      `SELECT * FROM upsert_semantic_memory_smart($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        memory.user_id,
        memory.task_id,
        memory.step_id,
        memory.fact,
        JSON.stringify(memory.embedding),
        similarityThreshold,
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
   * @param { string } id - Memory id (UUID).
   *
   * @returns { Memory<Id.Id> | undefined } Memory at the given id.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function select_memory(
    id: string
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
   * @param { string } id - The id of the memory to update (UUID).
   * @param { string } content - The content of the new memory.
   * @param { number[] } embedding - Vector-encoded memory.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function update_memory(
    id: string,
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
    memory_id: string;
    task_id: string;
    step_id: string;
    content: string;
    similarity: number;
    metadata: any; // JSONB from PostgreSQL
  }

  /**
   * Memory retrieval result interface for task and step-based queries
   */
  export interface MemoryRetrieval {
    memory_type: string;
    memory_id: string;
    content: string;
    task_id?: string;
    step_id?: string;
    created_at: Date;
    updated_at: Date;
    confidence: number;
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
  export async function retrieve_memory(
    strategy: 'holistic' | 'categorized',
    userId: string,
    embedding: number[],
    limit: number,
    threshold: number
  ): Promise<Similarity[]> {
    if (strategy === 'categorized') {
      const q = new Postgres.Query(
        `SELECT * FROM retrieve_similar_categorized_memories($1, $2, $3, $4)`,
        [userId, JSON.stringify(embedding), threshold, limit]
      );
      const result = await Postgres.query<Similarity>(q);
      return result;
    } else if (strategy === 'holistic') {
      const q = new Postgres.Query(
        `SELECT * FROM retrieve_similar_holistic_memories($1, $2, $3, $4)`,
        [userId, JSON.stringify(embedding), threshold, limit]
      );
      const result = await Postgres.query<Similarity>(q);
      return result;
    }
    return [];
  }
  /**
   * Retrieves all memories (both episodic and semantic) for a specific task_id
   *
   * @param { string } userId - User the memories are associated to.
   * @param { string } taskId - Task ID to retrieve memories for.
   * @param { number } limit - Optional limit on number of memories to return.
   *
   * @returns { MemoryRetrieval[] } Array of memories for the task.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function get_memories_by_task_id(
    userId: string,
    taskId: string,
    limit: number | null
  ): Promise<MemoryRetrieval[]> {
    const q = new Postgres.Query(
      `SELECT * FROM get_memories_by_task_id($1, $2, $3)`,
      [userId, taskId, limit]
    );
    const result = await Postgres.query<MemoryRetrieval>(q);
    return result;
  }

  /**
   * Retrieves all memories (both episodic and semantic) for a specific step_id
   *
   * @param { string } userId - User the memories are associated to.
   * @param { string } stepId - Step ID to retrieve memories for.
   * @param { number } limit - Optional limit on number of memories to return.
   *
   * @returns { MemoryRetrieval[] } Array of memories for the step.
   *
   * @throws { DatabaseError } If a database operation fails.
   */
  export async function get_memories_by_step_id(
    userId: string,
    stepId: string,
    limit: number | null
  ): Promise<MemoryRetrieval[]> {
    const q = new Postgres.Query(
      `SELECT * FROM get_memories_by_step_id($1, $2, $3,$4)`,
      [userId, stepId, limit]
    );
    const result = await Postgres.query<MemoryRetrieval>(q);
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
