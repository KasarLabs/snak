import { Module } from '@nestjs/common';
import { FileIngestionWorkerService } from './file-ingestion-worker.service.js';
import { ChunkingModule } from '../chunking/chunking.module.js';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { VectorStoreModule } from '../vector-store/vector-store.module.js';
import { FileValidationService } from '@snakagent/core';
import { MutexModule } from '../mutex/mutex.module.js';

@Module({
  imports: [ChunkingModule, EmbeddingsModule, VectorStoreModule, MutexModule],
  providers: [FileIngestionWorkerService, FileValidationService],
  exports: [FileIngestionWorkerService],
})
export class FileIngestionWorkerModule {}
