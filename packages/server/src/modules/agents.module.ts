import { Module } from '@nestjs/common';
import { AgentService } from '../services/agent.service.js';
import { DatabaseService } from '../services/database.service.js';
import { AgentsController } from '../controllers/agents.controller.js';
import { ConfigModule } from '../../config/config.module.js';
import { MetricsController } from '../controllers/metrics.controller.js';
import { AgentStorage } from '../agents.storage.js';
import { SupervisorService } from '../services/supervisor.service.js';

@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, AgentService, AgentStorage, SupervisorService],
  controllers: [AgentsController, MetricsController],
  exports: [DatabaseService, AgentService, AgentStorage, SupervisorService],
})
export class AgentsModule {}
