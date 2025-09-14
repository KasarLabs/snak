import { Module } from '@nestjs/common';
import { JobsMetadataService } from './jobs-metadata.service.js';
import { RedisCacheService } from '../cache/redis-cache.service.js';
import { RedisMutexService } from '../mutex/redis-mutex.service.js';

@Module({
  providers: [JobsMetadataService, RedisCacheService, RedisMutexService],
  exports: [JobsMetadataService],
})
export class JobsMetadataModule {}
