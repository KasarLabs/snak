import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service.js';

@Module({
  providers: [ChunkingService],
  exports: [ChunkingService],
})
export class ChunkingModule {}
