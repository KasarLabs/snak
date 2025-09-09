import { Module } from '@nestjs/common';
import { FileIngestionWorkerService } from './file-ingestion-worker.service.js';
import { ChunkingModule } from '../chunking/chunking.module.js';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { VectorStoreModule } from '../vector-store/vector-store.module.js';

@Module({
  imports: [
    ChunkingModule,
    EmbeddingsModule,
    VectorStoreModule,
  ],
  providers: [FileIngestionWorkerService],
  exports: [FileIngestionWorkerService],
})
export class FileIngestionWorkerModule {}
