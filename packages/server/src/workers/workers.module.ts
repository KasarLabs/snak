import { Module } from '@nestjs/common';
import { WorkersService } from './workers.service.js';
import { JobsMetadataModule } from '@snakagent/workers';
import { ConfigModule } from '../../config/config.module.js';
import { AgentsModule } from '../agents.module.js';

@Module({
  imports: [ConfigModule, AgentsModule, JobsMetadataModule],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
