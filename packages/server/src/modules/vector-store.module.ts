import { Module } from '@nestjs/common';
import { VectorStoreService } from '../services/vector-store.service.js';

@Module({
  providers: [VectorStoreService],
  exports: [VectorStoreService],
})
export class VectorStoreModule {}
