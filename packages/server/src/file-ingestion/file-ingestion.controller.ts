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
    const req = request as unknown as MultipartRequest;
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('Multipart request expected');
    }

    const userId = getUserIdFromHeaders(request);

    let agentId = '';
    let fileBuffer: Buffer | undefined;
    let fileName = '';

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'agentId') {
        agentId = String(part.value);
      } else if (part.type === 'file') {
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) {
          size += chunk.length;
          if (size > this.config.rag.maxRagSize) {
            part.file.destroy();
            throw new ForbiddenException('File size exceeds limit');
          }
          chunks.push(chunk);
        }
        fileBuffer = Buffer.concat(chunks);
        fileName = part.filename;
      }
    }
    if (!fileBuffer) {
      throw new BadRequestException('No file found in request');
    }

    try {
      const result = await this.service.process(
        agentId,
        fileBuffer,
        fileName,
        userId
      );
      result.chunks.forEach((c) => delete c.metadata.embedding);
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new InternalServerErrorException(
        `Embedding failed: ${errorMessage}`
      );
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
