import { Module } from '@nestjs/common';
import { ChunkingModule } from './chunking/chunking.module.js';
import { EmbeddingsModule } from './embeddings/embeddings.module.js';
import { VectorStoreModule } from './vector-store/vector-store.module.js';
import { FileIngestionWorkerModule } from './file-ingestion-worker/file-ingestion-worker.module.js';

@Module({
  imports: [
    ChunkingModule,
    EmbeddingsModule,
    VectorStoreModule,
    FileIngestionWorkerModule,
  ],
  exports: [
    ChunkingModule,
    EmbeddingsModule,
    VectorStoreModule,
    FileIngestionWorkerModule,
  ],
})
export class ServicesModule {}
