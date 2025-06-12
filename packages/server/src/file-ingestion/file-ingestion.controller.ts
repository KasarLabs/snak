import {
  Controller,
  Post,
  Req,
  BadRequestException,
  InternalServerErrorException,
  Get,
  Param,
  Body
} from '@nestjs/common';
import { FileIngestionService } from './file-ingestion.service.js';
import { FileContent } from './file-content.interface.js';
import { MultipartFile } from '@fastify/multipart';
import { FastifyRequest } from 'fastify';

interface MultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  parts: () => AsyncIterableIterator<MultipartFile>;
}

@Controller('files')
export class FileIngestionController {
  constructor(private readonly service: FileIngestionService) {}

  @Post('upload')
  async upload(@Req() request: FastifyRequest): Promise<FileContent> {
    const req = request as unknown as MultipartRequest;
    if (!req.isMultipart || !req.isMultipart()) {
      throw new BadRequestException('Multipart request expected');
    }

    const parts = req.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        try {
          const result = await this.service.process(buffer, part.filename);
          result.chunks.forEach((c) => delete c.metadata.embedding);
          return result;
        } catch (err: any) {
          throw new InternalServerErrorException(
            `Embedding failed: ${err.message}`,
          );
        }
      }
    }
    throw new BadRequestException('No file found in request');
  }

  @Get()
  async listFiles() {
    return this.service.listFiles();
  }

  @Get(':id')
  async getFile(@Param('id') id: string) {
    return this.service.getFile(id);
  }

  @Post()
  async deleteFile(@Body('id') id: string) {
    await this.service.deleteFile(id);
    return { deleted: true };
  }
}
