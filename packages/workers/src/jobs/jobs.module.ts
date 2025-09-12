import { Module } from '@nestjs/common';
import { FileIngestionProcessor } from './file-ingestion-processor.js';
import { FileIngestionWorkerModule } from '../services/file-ingestion-worker/file-ingestion-worker.module.js';

@Module({
  imports: [FileIngestionWorkerModule],
  providers: [FileIngestionProcessor],
  exports: [FileIngestionProcessor],
})
export class JobsModule {}
