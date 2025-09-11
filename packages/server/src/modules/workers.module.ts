import { Module } from '@nestjs/common';
import { WorkersService } from '../services/workers.service.js';
import { JobsMetadataModule } from '@snakagent/workers';
import { ConfigModule } from '../../config/config.module.js';
import { AgentsModule } from './agents.module.js';

@Module({
  imports: [ConfigModule, AgentsModule, JobsMetadataModule],
  controllers: [],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
