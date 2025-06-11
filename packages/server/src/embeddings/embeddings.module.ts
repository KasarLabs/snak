import { Module } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service.js';

@Module({
  imports: [],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}