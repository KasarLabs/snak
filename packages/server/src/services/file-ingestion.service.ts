import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { logger } from '@snakagent/core';
import { VectorStoreService } from './vector-store.service.js';
import { WorkersService } from './workers.service.js';
import { ConfigurationService } from '../../config/configuration.js';
import {
  FileContent,
  StoredFile,
} from '../interfaces/file-content.interface.js';

@Injectable()
export class FileIngestionService {
  constructor(
    private readonly vectorStore: VectorStoreService,
    private readonly workersService: WorkersService,
    private readonly config: ConfigurationService
  ) {}


  /**
   * List all files associated with a specific agent
   * @param agentId - The agent ID to list files for
   * @param userId - The user ID to verify ownership
   * @returns Promise<StoredFile[]> Array of stored file metadata
   * @throws ForbiddenException if the agent doesn't belong to the user
   */
  async listFiles(agentId: string, userId: string): Promise<StoredFile[]> {
    const docs = await this.vectorStore.listDocuments(agentId, userId);
    return docs.map((d) => ({
      id: d.document_id,
      originalName: d.original_name,
      mimeType: d.mime_type,
      size: d.size,
      uploadDate: (() => {
        try {
          const timestampStr = d.document_id.split('-')[0];
          const timestamp = Number(timestampStr);

          if (isNaN(timestamp) || timestamp <= 0) {
            return new Date().toISOString();
          }

          const date = new Date(timestamp);

          if (isNaN(date.getTime())) {
            return new Date().toISOString();
          }

          return date.toISOString();
        } catch (error) {
          return new Date().toISOString();
        }
      })(),
    }));
  }

  /**
   * Retrieve a specific file and its chunks by document ID
   * @param agentId - The agent ID that owns the file
   * @param id - The document ID of the file to retrieve
   * @param userId - The user ID to verify ownership
   * @returns Promise<FileContent> The file content with chunks and metadata
   * @throws ForbiddenException if the agent doesn't belong to the user
   * @throws Error if the document is not found
   */
  async getFile(
    agentId: string,
    id: string,
    userId: string
  ): Promise<FileContent> {
    const rows = await this.vectorStore.getDocument(agentId, id, userId);
    if (!rows.length) {
      throw new NotFoundException('Document not found');
    }
    const chunks = rows.map((r) => ({
      id: r.id,
      text: r.content,
      metadata: {
        documentId: id,
        chunkIndex: r.chunk_index,
        startToken: 0,
        endToken: 0,
      },
    }));
    const size = rows.reduce((acc, r) => acc + r.content.length, 0);
    return {
      chunks,
      metadata: {
        originalName: rows[0].original_name,
        mimeType: rows[0].mime_type,
        size,
      },
    };
  }

  /**
   * Delete a file and all its associated chunks from the vector store
   * @param agentId - The agent ID that owns the file
   * @param id - The document ID of the file to delete
   * @param userId - The user ID to verify ownership
   * @throws ForbiddenException if the agent doesn't belong to the user
   */
  async deleteFile(agentId: string, id: string, userId: string) {
    await this.vectorStore.deleteDocument(agentId, id, userId);
  }

  /**
   * Process file upload from multipart request parts
   * @param parts - Array of multipart parts (file parts only)
   * @param agentId - The agent ID for the file
   * @param userId - The user ID making the request
   * @returns Promise<{ jobId: string }> The job ID for the file processing
   * @throws BadRequestException if no file is provided
   * @throws ForbiddenException if file size exceeds limit
   */
  async processFileUpload(
    agentId: string,
    userId: string,
    fileId: string,
    fileName: string,
    mimeType: string,
    fileBuffer: Buffer,
    fileSize: number
  ): Promise<{ jobId: string }> {
    const jobId = await this.workersService.processFileAsync(
      agentId,
      userId,
      fileId,
      fileName,
      mimeType,
      fileBuffer,
      fileSize
    );

    logger.info(
      `File upload queued with job ID: ${jobId} for file: ${fileName}`
    );

    return { jobId };
  }
}
