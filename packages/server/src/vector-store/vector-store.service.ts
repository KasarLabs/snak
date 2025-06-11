import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Postgres } from '@snakagent/database';

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private initialized = false;

  async onModuleInit() {
    await this.init();
  }

  private async init() {
    if (this.initialized) return;
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
    `);
    try {
      await Postgres.query(q);
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize vector table', err);
      throw err;
    }
  }

  async upsert(
    entries: {
      id: string;
      vector: number[];
      content: string;
      metadata: {
        documentId: string;
        chunkIndex: number;
        originalName: string;
        mimeType: string;
      };
    }[],
  ) {
    const queries = entries.map(
      (e) =>
        new Postgres.Query(
          `INSERT INTO document_vectors(id, document_id, chunk_index, embedding, content, original_name, mime_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO UPDATE
           SET embedding = $4, content=$5, original_name=$6, mime_type=$7`,
          [
            e.id,
            e.metadata.documentId,
            e.metadata.chunkIndex,
            JSON.stringify(e.vector),
            e.content,
            e.metadata.originalName,
            e.metadata.mimeType,
          ],
        ),
    );
    if (queries.length) {
      await Postgres.transaction(queries);
    }
  }
  async listDocuments(): Promise<{
    document_id: string;
    original_name: string;
    mime_type: string;
    size: number;
  }[]> {
    const q = new Postgres.Query(
      `SELECT document_id, MAX(original_name) AS original_name, MAX(mime_type) AS mime_type, SUM(LENGTH(content)) AS size
       FROM document_vectors
       GROUP BY document_id`,
    );
    return await Postgres.query(q);
  }

  async getDocument(documentId: string): Promise<{
    id: string;
    chunk_index: number;
    content: string;
    original_name: string;
    mime_type: string;
  }[]> {
    const q = new Postgres.Query(
      `SELECT id, chunk_index, content, original_name, mime_type
       FROM document_vectors
       WHERE document_id = $1
       ORDER BY chunk_index ASC`,
      [documentId],
    );
    return await Postgres.query(q);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const q = new Postgres.Query(
      `DELETE FROM document_vectors WHERE document_id = $1`,
      [documentId],
    );
    await Postgres.query(q);
  }
}