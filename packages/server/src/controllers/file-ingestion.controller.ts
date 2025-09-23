import {
  Controller,
  Post,
  Req,
  BadRequestException,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { FileIngestionService } from '../services/file-ingestion.service.js';
import { FileValidationService, getGuardValue } from '@snakagent/core';
import { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';
import { ConfigurationService } from '../../config/configuration.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { ControllerHelpers } from '../utils/controller-helpers.js';
import { AgentStorage } from '../agents.storage.js';
import { logger } from '@snakagent/core';
import { randomUUID } from 'crypto';

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
    private readonly fileValidationService: FileValidationService,
    private readonly agentFactory: AgentStorage
  ) {}

  @Post('upload')
  async upload(@Req() request: FastifyRequest): Promise<{ jobId: string }> {
    return ErrorHandler.handleControllerError(async () => {
      const req = request as unknown as MultipartRequest;
      if (!req.isMultipart || !req.isMultipart()) {
        logger.error('Multipart request expected');
        throw new BadRequestException('Multipart request expected');
      }

      const userId = ControllerHelpers.getUserId(request);

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

            const maxRagSize = getGuardValue('rag.rag_max_size');

            if (size > maxRagSize) {
              logger.error(`File size ${size} exceeds limit ${maxRagSize}`);
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

      // Verify agent ownership before proceeding
      ControllerHelpers.verifyAgentOwnership(
        this.agentFactory,
        agentId,
        userId
      );

      const fileId = randomUUID();

      // Secure file validation using centralized service
      const validationResult = await this.fileValidationService.validateFile(
        fileBuffer,
        fileName
      );

      if (!validationResult.isValid) {
        logger.error(
          `File validation failed for ${fileName}: ${validationResult.error}`,
          {
            detectedMimeType: validationResult.detectedMimeType,
            declaredMimeType: validationResult.declaredMimeType,
          }
        );
        throw new BadRequestException(validationResult.error);
      }

      const mimeType = validationResult.validatedMimeType;

      logger.info(`File validation passed for ${fileName}: ${mimeType}`, {
        detectedMimeType: validationResult.detectedMimeType,
        declaredMimeType: validationResult.declaredMimeType,
      });

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
    }, 'upload');
  }

  @Post('list')
  async listFiles(
    @Body('agentId') agentId: string,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    ControllerHelpers.verifyAgentOwnership(this.agentFactory, agentId, userId);
    return this.service.listFiles(agentId, userId);
  }

  @Post('get')
  async getFile(
    @Body('agentId') agentId: string,
    @Body('fileId') fileId: string,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    ControllerHelpers.verifyAgentOwnership(this.agentFactory, agentId, userId);
    return this.service.getFile(agentId, fileId, userId);
  }

  @Post('delete')
  async deleteFile(
    @Body('agentId') agentId: string,
    @Body('fileId') fileId: string,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    ControllerHelpers.verifyAgentOwnership(this.agentFactory, agentId, userId);
    await this.service.deleteFile(agentId, fileId, userId);
    return { deleted: true };
  }
}
