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

interface MultipartField {
  type: 'field';
  fieldname: string;
  value: unknown;
}

interface MultipartRequest extends FastifyRequest {
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
          if (size > this.config.documents.maxDocumentSize) {
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
      const result = await this.service.process(agentId, fileBuffer, fileName);
      result.chunks.forEach((c) => delete c.metadata.embedding);
      return result;
    } catch (err: any) {
      throw new InternalServerErrorException(
        `Embedding failed: ${err.message}`
      );
    }
  }

  @Post('list')
  async listFiles(@Body('agentId') agentId: string) {
    return this.service.listFiles(agentId);
  }

  @Post('get')
  async getFile(
    @Body('agentId') agentId: string,
    @Body('fileId') fileId: string
  ) {
    return this.service.getFile(agentId, fileId);
  }

  @Post('delete')
  async deleteFile(
    @Body('agentId') agentId: string,
    @Body('fileId') fileId: string
  ) {
    await this.service.deleteFile(agentId, fileId);
    return { deleted: true };
  }
}
