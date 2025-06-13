import { Postgres } from '../../database.js';

export namespace documents {
  export async function init() {
    const q = new Postgres.Query(`
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE TABLE IF NOT EXISTS document_vectors(
        id VARCHAR PRIMARY KEY,
        document_id VARCHAR NOT NULL,
        chunk_index INTEGER NOT NULL,
        embedding vector(384) NOT NULL,
        content TEXT NOT NULL,
        original_name TEXT,
        mime_type TEXT
      );
      CREATE INDEX IF NOT EXISTS document_vectors_embedding_idx
        ON document_vectors USING ivfflat (embedding vector_cosine_ops);
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
    limit = 4,
  ): Promise<SearchResult[]> {
    const q = new Postgres.Query(
      `SELECT id, document_id, chunk_index, content, original_name, mime_type,
              1 - (embedding <=> $1::vector) AS similarity
       FROM document_vectors
       ORDER BY similarity DESC
       LIMIT $2`,
      [JSON.stringify(embedding), limit],
    );
    return await Postgres.query(q);
  }
}