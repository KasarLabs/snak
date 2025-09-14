import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';

@Module({
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
