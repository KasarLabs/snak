import { Injectable, ForbiddenException } from '@nestjs/common';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';

@Injectable()
export class VectorStoreService {
  /**
   * Upsert vector entries into the database (workers-specific function)
   * @param agentId - The agent ID
   * @param entries - Array of vector entries to upsert
   * @param userId - The user ID for ownership verification
   */
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
        fileSize: number;
      };
    }[],
    _userId: string
  ) {
    try {
      const queries = entries.map(
        (e) =>
          new Postgres.Query(
            `INSERT INTO document_vectors(id, agent_id, document_id, chunk_index, embedding, content, original_name, mime_type, file_size)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (id) DO UPDATE
             SET embedding = $5, content=$6, original_name=$7, mime_type=$8, file_size=$9
             WHERE document_vectors.agent_id = EXCLUDED.agent_id`,
            [
              e.id,
              agentId,
              e.metadata.documentId,
              e.metadata.chunkIndex,
              JSON.stringify(e.vector),
              e.content,
              e.metadata.originalName,
              e.metadata.mimeType,
              e.metadata.fileSize,
            ]
          )
      );
      if (queries.length) {
        await Postgres.transaction(queries);
      }
    } catch (err) {
      logger.error(`Upsert failed:`, err);
      throw err;
    }
  }
}
