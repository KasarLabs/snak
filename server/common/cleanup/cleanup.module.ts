import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupService } from './cleanup.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CleanupService],
  exports: [CleanupService],
})
export class CleanupModule {}
