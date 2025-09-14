import { Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service.js';

@Module({
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class WorkersCacheModule {}
