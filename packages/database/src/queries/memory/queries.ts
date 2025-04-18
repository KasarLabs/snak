import { query, transaction, Query } from '../../database.js';
import pg from 'pg';

export namespace memory {
  export async function init() {
    const t = [
      new Query(`CREATE EXTENSION IF NOT EXISTS vector;`),
      new Query(
        `CREATE TABLE IF NOT EXISTS agent_memories(
					id SERIAL PRIMARY KEY,
					user_id VARCHAR(100) NOT NULL,
					content TEXT NOT NULL,
					embedding vector(384) NOT NULL,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
					updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
					metadata JSONB NOT NULL,
					history JSONB NOT NULL
				);`
      ),
      new Query(`
				CREATE OR REPLACE FUNCTION insert_memory(
					id integer,
					user_id varchar(100),
					content text,
					embedding vector(384),
					created_at timestamp,
					updated_at timestamp,
					metadata jsonb,
					history jsonb
				) RETURNS void AS $$
					INSERT INTO agent_memories(
						id,
						user_id,
						content,
						embedding,
						created_at,
						updated_at,
						metadata,
						history
					) VALUES (
						COALESCE($1, nextval('agent_memories_id_seq')),
						$2,
						$3,
						$4,
						COALESCE($5, CURRENT_TIMESTAMP),
						COALESCE($6, CURRENT_TIMESTAMP),
						$7,
						$8
					) ON CONFLICT (id) DO UPDATE SET
						content = $3,
						embedding = $4,
						updated_at = COALESCE($6, CURRENT_TIMESTAMP),
						history = $8;
				$$ LANGUAGE sql
			`),
      new Query(`
				CREATE OR REPLACE FUNCTION select_memory(
					id integer
				) RETURNS TABLE (
					id INTEGER,
					user_id VARCHAR(100),
					content TEXT,
					embedding vector(384),
					created_at TIMESTAMP,
					updated_at TIMESTAMP,
					metadata JSONB,
					history JSONB
				) AS $$
					SELECT
						id,
						user_id,
						content,
						embedding,
						created_at,
						updated_at,
						metadata,
						history
					FROM
						agent_memories
					WHERE
						id = $1
				$$ LANGUAGE sql;
			`),
      new Query(`
				CREATE OR REPLACE FUNCTION update_memory(
					id integer,
					content text,
					embedding vector(384)
				) RETURNS void AS $$
					DECLARE
						m jsonb;
						t timestamp;
						history jsonb;
					BEGIN
						SELECT to_jsonb(mem.*) INTO m FROM select_memory($1) mem;

						t := CURRENT_TIMESTAMP;
						history := m->'history' || jsonb_build_array(jsonb_build_object(
							'value', m->>'content',
							'timestamp', t,
							'action', 'UPDATE'
						));

						PERFORM insert_memory(
							$1,
							(m->>'user_id')::varchar(100),
							$2,
							$3,
							(m->>'created_at')::timestamp,
							t,
							m->'metadata',
							history
						);
					END;
				$$ LANGUAGE plpgsql
			`),
    ];
    await transaction(t);

    const q = new Query(`SELECT 'vector'::regtype::oid;`);
    const oid = (await query<{ oid: number }>(q))[0].oid;
    pg.types.setTypeParser(oid, (v: any) => {
      return JSON.parse(v) as number[];
    });
  }

  export interface Memory {
    id?: number;
    user_id: string;
    content: string;
    embedding: number[];
    created_at?: Date;
    updated_at?: Date;
    metadata: Metadata;
    history: History[];
  }
  export interface Similarity {
    id: number;
    content: string;
    history: History[];
    similarity: number;
  }
  export interface Metadata {
    timestamp: string;
  }
  export interface History {
    value: string;
    timestamp: string;
    action: 'UPDATE';
  }
  export async function insert_memory(memory: Memory): Promise<void> {
    const q = new Query(
      `SELECT insert_memory(null, $1, $2, $3, $4, $5, $6, $7);`,
      [
        memory.user_id,
        memory.content,
        JSON.stringify(memory.embedding),
        memory.created_at,
        memory.updated_at,
        JSON.stringify(memory.metadata),
        JSON.stringify(memory.history),
      ]
    );
    await query(q);
  }
  export async function select_memory(id: number): Promise<Memory | undefined> {
    const q = new Query(`SELECT * FROM select_memory($1)`, [id]);
    const q_res = await query<Memory>(q);
    return q_res ? q_res[0] : undefined;
  }
  export async function update_memory(
    id: number,
    content: string,
    embedding: number[]
  ): Promise<void> {
    const q = new Query(`SELECT update_memory($1, $2, $3);`, [
      id,
      content,
      JSON.stringify(embedding),
    ]);
    await query(q);
  }
  export async function similar_memory(
    userId: string,
    embedding: number[]
  ): Promise<Similarity[]> {
    const q = new Query(
      `SELECT id, content, history, 1 - (embedding <=> $1::vector) AS similarity
				  FROM agent_memories
				  WHERE user_id = $2
				  ORDER BY similarity DESC
				  LIMIT 4;
			`,
      [JSON.stringify(embedding), userId]
    );
    return await query(q);
  }
}
