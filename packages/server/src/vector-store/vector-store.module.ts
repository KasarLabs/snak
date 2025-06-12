import { Module } from '@nestjs/common';
import { VectorStoreService } from './vector-store.service.js';

@Module({
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}