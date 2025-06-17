import { Postgres } from '../../database.js';

export namespace documents {
  export async function init() {
    const q = new Postgres.Query(`
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS document_vectors(
        id VARCHAR PRIMARY KEY,
        agent_id VARCHAR NOT NULL,
        document_id VARCHAR NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding vector(384) NOT NULL,
        content TEXT NOT NULL,
        original_name TEXT,
        mime_type TEXT
      );
      CREATE INDEX IF NOT EXISTS document_vectors_embedding_idx
        ON document_vectors USING ivfflat (embedding vector_cosine_ops);
      CREATE INDEX IF NOT EXISTS document_vectors_agent_idx
        ON document_vectors(agent_id);
      ANALYZE document_vectors;
    `);
    await Postgres.query(q);
  }

  export interface SearchResult {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    original_name: string;
    mime_type: string;
    similarity: number;
  }

  export async function search(
    embedding: number[],
    agentId: string,
    limit = 4
  ): Promise<SearchResult[]> {
    const q = new Postgres.Query(
      `SELECT id, document_id, chunk_index, content, original_name, mime_type,
              1 - (embedding <=> $1::vector) AS similarity
       FROM document_vectors
       WHERE agent_id = $2
       ORDER BY similarity DESC
       LIMIT $3`,
      [JSON.stringify(embedding), agentId, limit]
    );
    return await Postgres.query(q);
  }

  export async function totalSizeForAgent(agentId: string): Promise<number> {
    const q = new Postgres.Query(
      `SELECT COALESCE(SUM(LENGTH(content)),0) AS size FROM document_vectors WHERE agent_id = $1`,
      [agentId]
    );
    const res = await Postgres.query<{ size: string }>(q);
    return parseInt(res[0]?.size || '0', 10);
  }

  export async function totalSize(): Promise<number> {
    const q = new Postgres.Query(
      `SELECT COALESCE(SUM(LENGTH(content)),0) AS size FROM document_vectors`
    );
    const res = await Postgres.query<{ size: string }>(q);
    return parseInt(res[0]?.size || '0', 10);
  }
}
