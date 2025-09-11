import {
  Controller,
  Post,
  Get,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Body,
  ForbiddenException,
  Param,
  NotFoundException,
} from '@nestjs/common';
import {
  JobNotFoundError,
  JobNotCompletedError,
  JobFailedError,
  JobAccessDeniedError,
  UnknownJobStatusError,
} from '../common/errors/job-errors.js';
import { FileIngestionService } from './file-ingestion.service.js';
import { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';
import { ConfigurationService } from '../../config/configuration.js';
import { getUserIdFromHeaders } from '../utils/index.js';
import { logger } from '@snakagent/core';
import { WorkersService } from '../workers/workers.service.js';
import { randomUUID } from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

interface MultipartField {
  type: 'field';
  fieldname: string;
  value: unknown;
}

interface MultipartRequest {
  isMultipart: () => boolean;
  parts: () => AsyncIterableIterator<MultipartFile | MultipartField>;
}

@Controller('files')
export class FileIngestionController {
  constructor(
    private readonly service: FileIngestionService,
    private readonly config: ConfigurationService,
    private readonly workersService: WorkersService
  ) {}

  @Post('upload')
  async upload(@Req() request: FastifyRequest): Promise<{ jobId: string }> {
    try {
      const req = request as unknown as MultipartRequest;
      if (!req.isMultipart || !req.isMultipart()) {
        logger.error('Multipart request expected');
        throw new BadRequestException('Multipart request expected');
      }

      const userId = getUserIdFromHeaders(request);

      let agentId = '';
      let fileBuffer: Buffer | undefined;
      let fileName = '';
      let fileSize = 0;

      const parts = req.parts();
      let partCount = 0;

      for await (const part of parts) {
        partCount++;
        logger.debug(`Processing part ${partCount}, type: ${part.type}`);

        if (part.type === 'field' && part.fieldname === 'agentId') {
          agentId = String(part.value);
        } else if (part.type === 'file') {
          let size = 0;
          const chunks: Buffer[] = [];
          let chunkCount = 0;

          for await (const chunk of part.file) {
            chunkCount++;
            size += chunk.length;
            logger.debug(
              `Chunk ${chunkCount}: ${chunk.length} bytes (total: ${size} bytes)`
            );

            if (size > this.config.rag.maxRagSize) {
              logger.error(
                `File size ${size} exceeds limit ${this.config.rag.maxRagSize}`
              );
              part.file.destroy();
              throw new ForbiddenException('File size exceeds limit');
            }
            chunks.push(chunk);
          }

          fileBuffer = Buffer.concat(chunks);
          fileName = part.filename;
          fileSize = size;
        }
      }

      if (!fileBuffer) {
        logger.error('No file found in request');
        throw new BadRequestException('No file found in request');
      }

      if (!agentId || agentId.trim() === '') {
        logger.error('No agentId provided in request');
        throw new BadRequestException('agentId is required');
      }

      const fileId = randomUUID();

      let mimeType = 'application/octet-stream';
      try {
        const fileType = await fileTypeFromBuffer(fileBuffer);
        if (fileType?.mime) {
          mimeType = fileType.mime;
        } else {
          const extension = fileName.toLowerCase().split('.').pop();
          switch (extension) {
            case 'txt':
              mimeType = 'text/plain';
              break;
            case 'md':
            case 'markdown':
              mimeType = 'text/markdown';
              break;
            case 'csv':
              mimeType = 'text/csv';
              break;
            case 'json':
              mimeType = 'application/json';
              break;
            case 'html':
            case 'htm':
              mimeType = 'text/html';
              break;
            case 'pdf':
              mimeType = 'application/pdf';
              break;
            case 'doc':
              mimeType = 'application/msword';
              break;
            case 'docx':
              mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
              break;
            default:
              break;
          }
        }
      } catch (error) {
        logger.warn(
          `Failed to detect file type for ${fileName}, using extension-based detection`,
          error
        );
        throw new BadRequestException('Failed to detect file type');
      }

      const { jobId } = await this.service.processFileUpload(
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
    } catch (err: unknown) {
      logger.error(`Upload failed:`, err);
      request.log?.error?.({ err }, 'File upload failed');

      if (
        err instanceof ForbiddenException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      throw new InternalServerErrorException('File processing failed');
    }
  }

  @Post('list')
  async listFiles(
    @Body('agentId') agentId: string,
    @Req() req: FastifyRequest
  ) {
    const userId = getUserIdFromHeaders(req);
    return this.service.listFiles(agentId, userId);
  }

  @Post('get')
  async getFile(
    @Body('agentId') agentId: string,
    @Body('fileId') fileId: string,
    @Req() req: FastifyRequest
  ) {
    const userId = getUserIdFromHeaders(req);
    return this.service.getFile(agentId, fileId, userId);
  }

  @Post('delete')
  async deleteFile(
    @Body('agentId') agentId: string,
    @Body('fileId') fileId: string,
    @Req() req: FastifyRequest
  ) {
    const userId = getUserIdFromHeaders(req);
    await this.service.deleteFile(agentId, fileId, userId);
    return { deleted: true };
  }

  @Get('status/:jobId')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @Req() request: FastifyRequest
  ) {
    try {
      const userId = getUserIdFromHeaders(request);
      const status = await this.workersService.getJobStatusForUser(
        jobId,
        userId
      );

      if (!status) {
        logger.error(`Job ${jobId} not found`);
        throw new NotFoundException(`Job ${jobId} not found`);
      }

      return {
        jobId: status.id,
        status: status.status,
        createdAt: status.createdAt,
        processedOn: status.processedOn,
        finishedOn: status.finishedOn,
        error: status.error,
      };
    } catch (error) {
      logger.error(`Failed to get job status for ${jobId}:`, error);

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (
        error instanceof ForbiddenException ||
        error instanceof JobAccessDeniedError
      ) {
        throw new ForbiddenException(
          'Access denied: Job does not belong to user'
        );
      }

      throw new InternalServerErrorException('Failed to get job status');
    }
  }

  @Get('result/:jobId')
  async getJobResult(
    @Param('jobId') jobId: string,
    @Req() request: FastifyRequest
  ) {
    try {
      const userId = getUserIdFromHeaders(request);
      const result = await this.workersService.getJobResultForUser(
        jobId,
        userId
      );

      if (result && result.chunks) {
        result.chunks.forEach((chunk: any) => {
          if (chunk.metadata && chunk.metadata.embedding) {
            delete chunk.metadata.embedding;
          }
        });
      }

      return result;
    } catch (error) {
      logger.error(`Failed to get job result for ${jobId}:`, error);

      if (error instanceof JobNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof JobAccessDeniedError) {
        throw new ForbiddenException(
          'Access denied: Job does not belong to user'
        );
      }

      if (error instanceof JobNotCompletedError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof JobFailedError) {
        throw new InternalServerErrorException(`Job failed: ${error.message}`);
      }

      if (error instanceof UnknownJobStatusError) {
        throw new InternalServerErrorException(
          `Unknown job status: ${error.message}`
        );
      }

      throw new InternalServerErrorException('Failed to get job result');
    }
  }

  @Get('queues/metrics')
  async getQueueMetrics() {
    try {
      return await this.workersService.getQueueMetrics();
    } catch (error) {
      logger.error('Failed to get queue metrics:', error);
      throw new InternalServerErrorException('Failed to get queue metrics');
    }
  }
}
