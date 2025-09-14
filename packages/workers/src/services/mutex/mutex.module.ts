import { Module } from '@nestjs/common';
import { RedisMutexService } from './redis-mutex.service.js';

@Module({
  providers: [RedisMutexService],
  exports: [RedisMutexService],
})
export class MutexModule {}
