import { Module } from '@nestjs/common';
import { AgentService } from '../services/agent.service.js';
import { DatabaseService } from '../services/database.service.js';
import { AgentsController } from '../controllers/agents.controller.js';
import { ConfigModule } from '../../config/config.module.js';
import { MetricsController } from '../controllers/metrics.controller.js';
import { AgentStorage } from '../agents.storage.js';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, AgentService, AgentStorage],
  controllers: [AgentsController, MetricsController],
  exports: [DatabaseService, AgentService, AgentStorage],
})
export class AgentsModule {}
