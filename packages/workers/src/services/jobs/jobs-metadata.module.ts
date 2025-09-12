import { Module } from '@nestjs/common';
import { JobsMetadataService } from './jobs-metadata.service.js';
import { RedisCacheService } from '../cache/redis-cache.service.js';

@Module({
  providers: [JobsMetadataService, RedisCacheService],
  exports: [JobsMetadataService],
})
export class JobsMetadataModule {}
