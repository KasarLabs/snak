import {
  Controller,
  Post,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { FileIngestionService } from './file-ingestion.service.js';
import { FileContent } from './file-content.interface.js';
import { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';
import { ConfigurationService } from '../../config/configuration.js';
import { getUserIdFromHeaders } from '../utils/index.js';
import { logger } from '@snakagent/core';

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
    private readonly config: ConfigurationService
  ) {}

  @Post('upload')
  async upload(@Req() request: FastifyRequest): Promise<FileContent> {
    
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
            logger.debug(`Chunk ${chunkCount}: ${chunk.length} bytes (total: ${size} bytes)`);
            
            if (size > this.config.rag.maxRagSize) {
              logger.error(`File size ${size} exceeds limit ${this.config.rag.maxRagSize}`);
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
      
      const result = await this.service.process(
        agentId,
        fileBuffer,
        fileName,
        userId
      );
      result.chunks.forEach((c) => delete c.metadata.embedding);
      
      return result;
    } catch (err: unknown) {
      logger.error(`Upload failed:`, err);
      request.log?.error?.({ err }, 'File upload failed');
      
      if (err instanceof ForbiddenException || err instanceof BadRequestException) {
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
}
