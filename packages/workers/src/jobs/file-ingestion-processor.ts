import type { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FileIngestionJobPayload } from '../queues/file-ingestion-queue.schema.js';
import { logger } from '@snakagent/core';
import { FileIngestionResult } from '../types/index.js';
import { FileIngestionWorkerService } from '../services/file-ingestion-worker/file-ingestion-worker.service.js';

@Injectable()
export class FileIngestionProcessor {
  constructor(
    private readonly fileIngestionWorkerService: FileIngestionWorkerService
  ) {}

  async process(
    job: Job<FileIngestionJobPayload>
  ): Promise<FileIngestionResult> {
    const { agentId, userId, fileId, originalName, mimeType, buffer, size } =
      job.data;

    logger.info(
      `Processing file ingestion for agent ${agentId}, file: ${originalName} (${size} bytes)`
    );

    try {
      const content = buffer.toString('base64');

      const jobResult =
        await this.fileIngestionWorkerService.processFileIngestionJob({
          documentId: fileId,
          agentId,
          userId,
          originalName,
          mimeType,
          content,
          size,
          options: {
            generateEmbeddings: true,
            storeInVectorDB: true,
            contentEncoding: 'base64',
          },
        });

      if (!jobResult.success) {
        logger.error(
          `File ingestion failed for ${originalName}: ${jobResult.error}`
        );
        throw new Error(jobResult.error || 'File ingestion failed');
      }

      const processingResult = jobResult.result!;

      const result: FileIngestionResult = {
        success: true,
        fileId,
        agentId,
        originalName,
        mimeType,
        size,
        processedAt: new Date().toISOString(),
        chunks: [],
        chunksCount: processingResult.chunksCount,
        embeddingsCount: processingResult.embeddingsCount,
        processingTime: processingResult.processingTime,
        userId,
      };

      logger.info(
        `File ingestion completed for ${originalName}: ${processingResult.chunksCount} chunks, ${processingResult.embeddingsCount} embeddings in ${processingResult.processingTime}ms`
      );

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        `File ingestion failed for ${originalName} (agent: ${agentId}):`,
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          fileId,
          agentId,
          userId,
          originalName,
          mimeType,
          size,
        }
      );

      throw error;
    }
  }
}
