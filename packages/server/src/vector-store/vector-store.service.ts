import { Injectable, ForbiddenException } from '@nestjs/common';
import { Postgres } from '@snakagent/database';

@Injectable()
export class VectorStoreService {

  /**
   * List all documents for a specific agent (API-specific function)
   * @param agentId - The agent ID
   * @param userId - The user ID for ownership verification
   * @returns Promise<Array> Array of document metadata
   */
  async listDocuments(
    agentId: string,
    userId: string
  ): Promise<
    {
      document_id: string;
      original_name: string;
      mime_type: string;
      size: number;
    }[]
  > {
    const q = new Postgres.Query(
      `SELECT dv.document_id,
        (SELECT DISTINCT original_name FROM document_vectors dv2 WHERE dv2.document_id = dv.document_id LIMIT 1) AS original_name,
        (SELECT DISTINCT mime_type FROM document_vectors dv2 WHERE dv2.document_id = dv.document_id LIMIT 1) AS mime_type,
        SUM(LENGTH(dv.content)) AS size
       FROM document_vectors dv
       INNER JOIN agents a ON a.id = dv.agent_id
       WHERE dv.agent_id = $1 AND a.user_id = $2
       GROUP BY dv.document_id`,
      [agentId, userId]
    );
    return await Postgres.query(q);
  }

  /**
   * Get a specific document and its chunks (API-specific function)
   * @param agentId - The agent ID
   * @param documentId - The document ID
   * @param userId - The user ID for ownership verification
   * @returns Promise<Array> Array of document chunks
   */
  async getDocument(
    agentId: string,
    documentId: string,
    userId: string
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
      `SELECT dv.id, dv.chunk_index, dv.content, dv.original_name, dv.mime_type
       FROM document_vectors dv
       INNER JOIN agents a ON a.id = dv.agent_id
       WHERE dv.agent_id = $1 AND dv.document_id = $2 AND a.user_id = $3
       ORDER BY dv.chunk_index ASC`,
      [agentId, documentId, userId]
    );
    return await Postgres.query(q);
  }

  /**
   * Delete a specific document (API-specific function)
   * @param agentId - The agent ID
   * @param documentId - The document ID
   * @param userId - The user ID for ownership verification
   */
  async deleteDocument(
    agentId: string,
    documentId: string,
    userId: string
  ): Promise<void> {

    const q = new Postgres.Query(
      `DELETE FROM document_vectors 
       WHERE agent_id = $1 AND document_id = $2
       AND EXISTS (
         SELECT 1 FROM agents a 
         WHERE a.id = document_vectors.agent_id AND a.user_id = $3
       )`,
      [agentId, documentId, userId]
    );
    await Postgres.query(q);
  }
}
