import { Module } from '@nestjs/common';
import { FileIngestionService } from './file-ingestion.service.js';
import { FileIngestionController } from './file-ingestion.controller.js';
import { ChunkingModule } from '../chunking/chunking.module.js';
import { EmbeddingsModule } from '../embeddings/embeddings.module.js';
import { VectorStoreModule } from '../vector-store/vector-store.module.js';
import { AgentsModule } from '../agents.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { ConfigurationService } from '../../config/configuration.js';

@Module({
  imports: [AgentsModule, ChunkingModule, EmbeddingsModule, VectorStoreModule, ConfigModule],
  controllers: [FileIngestionController],
  providers: [FileIngestionService, ConfigurationService],
  exports: [FileIngestionService],
})
export class FileIngestionModule {}
