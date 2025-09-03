import { Module } from '@nestjs/common';
import { WorkersService } from './workers.service.js';

@Module({
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
