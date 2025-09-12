import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service.js';

@Module({
  imports: [],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
