import { Injectable } from '@nestjs/common';
import { rag } from '@snakagent/database/queries';

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
  ): Promise<rag.DocumentMetadata[]> {
    return await rag.listDocuments(agentId, userId);
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
  ): Promise<rag.DocumentChunk[]> {
    return await rag.getDocument(agentId, documentId, userId);
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
    return await rag.deleteDocument(agentId, documentId, userId);
  }
}
