import { Injectable, ForbiddenException } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { Postgres } from '@snakagent/database';
import { logger, loadRagConfig, Chunk } from '@snakagent/core';
import { ChunkingService } from '../chunking/chunking.service.js';
import { EmbeddingsService } from '../embeddings/embeddings.service.js';
import { VectorStoreService } from '../vector-store/vector-store.service.js';
import {
  FileIngestionJobData,
  FileIngestionJobResult,
  FileProcessingResult,
  FileProcessingOptions,
  VectorStoreEntry,
  FileIngestionStatus,
  FileIngestionProgress,
  SupportedMimeType,
} from '../../types/file-ingestion.js';
import { rag } from '@snakagent/database/queries';

const userMutexes = new Map<string, Promise<void>>();

async function acquireUserMutex(userId: string): Promise<() => void> {
  const existingMutex = userMutexes.get(userId);

  if (existingMutex) {
    await existingMutex;
  }

  let releaseMutex: () => void;
  const mutexPromise = new Promise<void>((resolve) => {
    releaseMutex = resolve;
  });

  userMutexes.set(userId, mutexPromise);

  return () => {
    userMutexes.delete(userId);
    releaseMutex();
  };
}

@Injectable()
export class FileIngestionWorkerService {
  constructor(
    private readonly chunkingService: ChunkingService,
    private readonly embeddingsService: EmbeddingsService,
    private readonly vectorStore: VectorStoreService
  ) {}

  /**
   * Process a file ingestion job in the worker context
   * @param jobData - The file ingestion job data
   * @returns Promise<FileIngestionJobResult>
   */
  async processFileIngestionJob(
    jobData: FileIngestionJobData
  ): Promise<FileIngestionJobResult> {
    const startTime = Date.now();
    const {
      documentId,
      agentId,
      userId,
      originalName,
      mimeType,
      content,
      size,
      options = {},
    } = jobData;

    logger.info(
      `Processing file ingestion for agent ${agentId}, file: ${originalName}`
    );

    const releaseMutex = await acquireUserMutex(userId);

    try {
      await this.checkStorageLimits(agentId, userId, size);

      const contentBuffer = Buffer.isBuffer(content)
        ? content
        : options?.contentEncoding === 'base64'
          ? Buffer.from(content as string, 'base64')
          : Buffer.from(content as string, 'utf8');
      const text = await this.extractRawText(contentBuffer, mimeType);

      const strategy = this.determineProcessingStrategy(mimeType);
      const { chunkSize, overlap } = this.computeChunkParams(size);

      const processingOptions: FileProcessingOptions = {
        chunkSize,
        overlap,
        strategy,
        generateEmbeddings: options.generateEmbeddings ?? true,
        storeInVectorDB: options.storeInVectorDB ?? true,
        ...options,
      };

      const chunks = await this.chunkingService.chunkText(documentId, text, {
        chunkSize: processingOptions.chunkSize,
        overlap: processingOptions.overlap,
        strategy: processingOptions.strategy,
      });

      const MAX_CHUNKS = 200;
      if (chunks.length > MAX_CHUNKS) {
        chunks.splice(MAX_CHUNKS);
        logger.warn(
          `File ${originalName} had ${chunks.length} chunks, limited to ${MAX_CHUNKS}`
        );
      }

      let embeddings: number[][] = [];
      if (
        chunks.length > 0 &&
        (processingOptions.generateEmbeddings ||
          processingOptions.storeInVectorDB)
      ) {
        const texts = chunks.map((c: Chunk) => c.text);
        embeddings = await this.embeddingsService.embedDocuments(texts);
      }
      if (embeddings.length && embeddings.length !== chunks.length) {
        throw new Error(
          `Embeddings/chunks mismatch: ${embeddings.length} vs ${chunks.length}`
        );
      }

      if (processingOptions.storeInVectorDB && chunks.length > 0) {
        if (embeddings.length === 0) {
          throw new Error(
            'storeInVectorDB=true requires embeddings, but none were generated'
          );
        }
        await this.storeChunksInVectorDB(
          agentId,
          userId,
          documentId,
          chunks,
          embeddings,
          originalName,
          mimeType,
          size
        );
      }

      const processingTime = Date.now() - startTime;
      const result: FileProcessingResult = {
        documentId,
        originalName,
        mimeType,
        size,
        chunksCount: chunks.length,
        embeddingsCount: embeddings.length,
        success: true,
        processingTime,
        agentId,
        userId,
      };

      logger.info(
        `File ingestion completed for ${originalName} in ${processingTime}ms`
      );

      return {
        success: true,
        result,
        retryable: false,
      };
    } catch (error) {
      logger.error(`File ingestion failed for ${originalName}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryable: this.isRetryableError(error),
      };
    } finally {
      releaseMutex();
    }
  }

  /**
   * Get the total size for a specific agent
   * @param agentId - The agent ID
   * @param userId - The user ID for ownership verification
   * @returns Promise<number> The total size in bytes
   */
  async getAgentSize(agentId: string, userId: string): Promise<number> {
    try {
      const size = await rag.totalSizeForAgent(agentId);
      return size;
    } catch (err) {
      logger.error(`Failed to get agent size:`, err);
      throw err;
    }
  }

  /**
   * Get the total size for a specific user across all agents
   * @param userId - The user ID
   * @returns Promise<number> The total size in bytes
   */
  async getTotalSize(userId: string): Promise<number> {
    try {
      const size = await rag.totalSize(userId);
      return size;
    } catch (err) {
      logger.error(`Failed to get total size:`, err);
      throw err;
    }
  }

  /**
   * Check storage limits before processing
   * @param agentId - The agent ID
   * @param userId - The user ID
   * @param fileSize - The size of the file to be processed
   */
  async checkStorageLimits(
    agentId: string,
    userId: string,
    fileSize: number
  ): Promise<void> {
    const agentSize = await this.getAgentSize(agentId, userId);
    const totalSize = await this.getTotalSize(userId);

    let maxAgentSize: number;
    let maxProcessSize: number;

    try {
      const ragConfigPath =
        process.env.RAG_CONFIG_PATH || '../../config/rag/default.rag.json';
      const ragConfig = await loadRagConfig(ragConfigPath);
      maxAgentSize = ragConfig.maxAgentSize;
      maxProcessSize = ragConfig.maxProcessSize;
      logger.info(
        `Loaded RAG config: maxAgentSize=${maxAgentSize}, maxProcessSize=${maxProcessSize}`
      );
    } catch (error) {
      logger.warn(`Failed to load RAG config, using defaults: ${error}`);
      maxAgentSize = 10 * 1024 * 1024; // 10MB per agent (matching default.rag.json)
      maxProcessSize = 50 * 1024 * 1024; // 50MB total (matching default.rag.json)
    }

    // Log detailed size information for debugging
    logger.info(
      `File ingestion size check for agent ${agentId} (user ${userId}):`
    );
    logger.info(
      `  - Current agent size: ${agentSize} bytes (${(agentSize / 1024 / 1024).toFixed(2)} MB)`
    );
    logger.info(
      `  - Current total size: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`
    );
    logger.info(
      `  - New file size: ${fileSize} bytes (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
    );
    logger.info(
      `  - Agent size after upload: ${agentSize + fileSize} bytes (${((agentSize + fileSize) / 1024 / 1024).toFixed(2)} MB)`
    );
    logger.info(
      `  - Total size after upload: ${totalSize + fileSize} bytes (${((totalSize + fileSize) / 1024 / 1024).toFixed(2)} MB)`
    );
    logger.info(
      `  - Agent size limit: ${maxAgentSize} bytes (${(maxAgentSize / 1024 / 1024).toFixed(2)} MB)`
    );
    logger.info(
      `  - Process size limit: ${maxProcessSize} bytes (${(maxProcessSize / 1024 / 1024).toFixed(2)} MB)`
    );

    if (agentSize + fileSize > maxAgentSize) {
      logger.error(
        `Agent storage limit exceeded: ${agentSize + fileSize} > ${maxAgentSize}`
      );
      throw new Error('Agent rag storage limit exceeded');
    }

    if (totalSize + fileSize > maxProcessSize) {
      logger.error(
        `Process storage limit exceeded: ${totalSize + fileSize} > ${maxProcessSize}`
      );
      throw new Error('Process rag storage limit exceeded');
    }
  }

  /**
   * Determine the processing strategy based on file type
   * @param mimeType - The MIME type of the file
   * @returns The processing strategy
   */
  private determineProcessingStrategy(
    mimeType: string
  ): 'adaptive' | 'whitespace' | 'structured' {
    if (
      mimeType === 'text/csv' ||
      mimeType === 'application/csv' ||
      mimeType === 'application/json' ||
      mimeType === 'text/json'
    ) {
      return 'structured';
    }
    return 'adaptive';
  }

  /**
   * Compute chunk parameters based on file size
   * @param size - The file size in bytes
   * @returns Chunk size and overlap parameters
   */
  private computeChunkParams(size: number): {
    chunkSize: number;
    overlap: number;
  } {
    const chunkSize =
      size > 1_000_000
        ? 1000
        : size > 100_000
          ? 500
          : size > 10_000
            ? 200
            : 100;
    const overlap = Math.floor(chunkSize * 0.1);
    return { chunkSize, overlap };
  }

  /**
   * Extract raw text from various file formats
   * @param buffer - The file buffer
   * @param mimeType - The MIME type of the file
   * @returns The extracted text
   */
  private async extractRawText(
    buffer: Buffer,
    mimeTypeHint?: string
  ): Promise<string> {
    const detected = await fileTypeFromBuffer(buffer);
    const type = detected?.mime ?? mimeTypeHint ?? 'application/octet-stream';

    try {
      let result: string;

      if (type === 'application/pdf') {
        result = await this.extractPdf(buffer);
      } else if (
        type ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        result = await this.extractDocx(buffer);
      } else if (type === 'text/csv' || type === 'application/csv') {
        const csvText = await this.parseCsv(buffer);
        result = this.cleanText(csvText);
      } else if (type === 'application/json' || type === 'text/json') {
        const obj = JSON.parse(buffer.toString('utf8'));
        result = JSON.stringify(obj, null, 2);
      } else {
        const text = buffer.toString('utf8');
        result = this.cleanText(text);
      }

      return result;
    } catch (err) {
      logger.error(`Text extraction failed:`, err);
      throw err;
    }
  }

  /**
   * Extract text from PDF files
   * @param buffer - The PDF buffer
   * @returns The extracted text
   */
  private async extractPdf(buffer: Buffer): Promise<string> {
    try {
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const textParts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        textParts.push(pageText);
      }

      return textParts.join('\n');
    } catch (err) {
      logger.error(`PDF extraction failed:`, err);
      throw err;
    }
  }

  /**
   * Extract text from DOCX files
   * @param buffer - The DOCX buffer
   * @returns The extracted text
   */
  private async extractDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (err) {
      logger.error(`DOCX extraction failed:`, err);
      throw err;
    }
  }

  /**
   * Parse CSV files
   * @param buffer - The CSV buffer
   * @returns The parsed CSV text
   */
  private async parseCsv(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);

      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          const csvText = results
            .map((row) => Object.values(row).join(', '))
            .join('\n');
          resolve(csvText);
        })
        .on('error', reject);
    });
  }

  /**
   * Clean and normalize text
   * @param text - The raw text
   * @returns The cleaned text
   */
  private cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Store chunks in the vector database
   * @param agentId - The agent ID
   * @param userId - The user ID
   * @param documentId - The document ID
   * @param chunks - The text chunks
   * @param embeddings - The embeddings for the chunks
   * @param originalName - The original file name
   * @param mimeType - The MIME type
   */
  private async storeChunksInVectorDB(
    agentId: string,
    userId: string,
    documentId: string,
    chunks: Chunk[],
    embeddings: number[][],
    originalName: string,
    mimeType: SupportedMimeType,
    fileSize: number
  ): Promise<void> {
    try {
      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embeddings/chunks length mismatch: ${embeddings.length} vs ${chunks.length}`
        );
      }
      const entries: VectorStoreEntry[] = chunks.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddings[index],
        content: chunk.text,
        metadata: {
          documentId,
          chunkIndex: chunk.metadata.chunkIndex,
          originalName,
          mimeType,
          fileSize,
        },
      }));

      await this.vectorStore.upsert(agentId, entries, userId);
    } catch (err) {
      logger.error(`Failed to store chunks in vector DB:`, err);
      throw err;
    }
  }

  /**
   * Determine if an error is retryable
   * @param error - The error to check
   * @returns True if the error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof ForbiddenException) {
      return false; // Authorization errors are not retryable
    }

    if (error.message?.includes('storage limit exceeded')) {
      return false; // Storage limit errors are not retryable
    }

    // Network errors, temporary service unavailability, etc. are retryable
    return true;
  }

  /**
   * Get file ingestion progress (for future use with progress tracking)
   * @param documentId - The document ID
   * @returns The current progress
   */
  async getFileIngestionProgress(
    documentId: string
  ): Promise<FileIngestionProgress> {
    // This would typically query a progress tracking system
    // For now, return a basic progress object
    return {
      documentId,
      status: FileIngestionStatus.COMPLETED,
      progress: 100,
      currentStep: 'completed',
      totalSteps: 1,
      completedSteps: 1,
      startedAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    };
  }
}
