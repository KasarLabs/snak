import {
  Controller,
  Post,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Get,
  Param,
  Body,
  ForbiddenException,
} from '@nestjs/common';
import { FileIngestionService } from './file-ingestion.service.js';
import { FileContent } from './file-content.interface.js';
import { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';

// TODO set MAX_FILE_SIZE config file
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  parts: () => AsyncIterableIterator<MultipartFile>;
}

@Controller('files')
export class FileIngestionController {
  constructor(private readonly service: FileIngestionService) {}

  @Post('upload')
async upload(
  @Body('agentId') agentId: string,
  @Req() request: FastifyRequest,
): Promise<FileContent> {
    const req = request as unknown as MultipartRequest;
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('Multipart request expected');
    }

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        if (buffer.length > MAX_FILE_SIZE) {
          throw new ForbiddenException('File size exceeds 10MB limit');
        }
        try {
          const result = await this.service.process(agentId, buffer, part.filename);
          result.chunks.forEach((c) => delete c.metadata.embedding);
          return result;
        } catch (err: any) {
          throw new InternalServerErrorException(
            `Embedding failed: ${err.message}`
          );
        }
      }
    }
    throw new BadRequestException('No file found in request');
  }

  @Post('list')
  async listFiles(@Body('agentId') agentId: string) {
    return this.service.listFiles(agentId);
  }

  @Post('get')
  async getFile(@Body('agentId') agentId: string, @Body('fileId') fileId: string) {
    return this.service.getFile(agentId, fileId);
  }

  @Post('delete')
  async deleteFile(@Body('agentId') agentId: string, @Body('fileId') fileId: string) {
    await this.service.deleteFile(agentId, fileId);
    return { deleted: true };
  }
}
