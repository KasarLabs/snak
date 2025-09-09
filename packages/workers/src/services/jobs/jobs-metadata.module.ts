import { Module } from '@nestjs/common';
import { JobsMetadataService } from './jobs-metadata.service.js';
import { CacheService } from '../cache/cache.service.js';

@Module({
  providers: [JobsMetadataService, CacheService],
  exports: [JobsMetadataService],
})
export class JobsMetadataModule {}
