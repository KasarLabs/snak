import { Module } from '@nestjs/common';
import { FileIngestionService } from '../services/file-ingestion.service.js';
import { FileIngestionController } from '../controllers/file-ingestion.controller.js';
import { VectorStoreModule } from './vector-store.module.js';
import { AgentsModule } from './agents.module.js';
import { ConfigModule } from '../../config/config.module.js';
import { WorkersModule } from './workers.module.js';

@Module({
  imports: [
    AgentsModule,
    VectorStoreModule,
    ConfigModule,
    WorkersModule,
  ],
  controllers: [FileIngestionController],
  providers: [FileIngestionService],
  exports: [FileIngestionService],
})
export class FileIngestionModule {}
