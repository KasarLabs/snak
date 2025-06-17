import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Postgres } from '@snakagent/database';
import { documents } from '@snakagent/database/queries';

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private initialized = false;

  async onModuleInit() {
    await this.init();
  }

  private async init() {
    if (this.initialized) return;
    try {
      await documents.init();
      this.initialized = true;
    } catch (err) {
      this.logger.error('Failed to initialize vector table', err);
      throw err;
    }
  }

  async upsert(
    agentId: string,
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
    }[]
  ) {
    const queries = entries.map(
      (e) =>
        new Postgres.Query(
          `INSERT INTO document_vectors(id, agent_id, document_id, chunk_index, embedding, content, original_name, mime_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (id) DO UPDATE
           SET embedding = $5, content=$6, original_name=$7, mime_type=$8`,
          [
            e.id,
            agentId,
            e.metadata.documentId,
            e.metadata.chunkIndex,
            JSON.stringify(e.vector),
            e.content,
            e.metadata.originalName,
            e.metadata.mimeType,
          ]
        )
    );
    if (queries.length) {
      await Postgres.transaction(queries);
    }
  }
  async listDocuments(agentId: string): Promise<
    {
      document_id: string;
      original_name: string;
      mime_type: string;
      size: number;
    }[]
  > {
    const q = new Postgres.Query(
      `SELECT document_id, MAX(original_name) AS original_name, MAX(mime_type) AS mime_type, SUM(LENGTH(content)) AS size
       FROM document_vectors
        WHERE agent_id = $1
       GROUP BY document_id`,
      [agentId]
    );
    return await Postgres.query(q);
  }

  async getDocument(
    agentId: string,
    documentId: string
  ): Promise<
    {
      id: string;
      chunk_index: number;
      content: string;
      original_name: string;
      mime_type: string;
    }[]
  > {
    const q = new Postgres.Query(
      `SELECT id, chunk_index, content, original_name, mime_type
       FROM document_vectors
       WHERE agent_id = $1 AND document_id = $2
       ORDER BY chunk_index ASC`,
      [agentId, documentId]
    );
    return await Postgres.query(q);
  }

  async deleteDocument(agentId: string, documentId: string): Promise<void> {
    const q = new Postgres.Query(
      `DELETE FROM document_vectors WHERE agent_id = $1 AND document_id = $2`,
      [agentId, documentId]
    );
    await Postgres.query(q);
  }

  async getAgentSize(agentId: string): Promise<number> {
    return documents.totalSizeForAgent(agentId);
  }

  async getTotalSize(): Promise<number> {
    return documents.totalSize();
  }
}
