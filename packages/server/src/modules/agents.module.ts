import { Module } from '@nestjs/common';
import { AgentService } from '../services/agent.service.js';
import { DatabaseService } from '../services/database.service.js';
import { AgentsController } from '../controllers/agents.controller.js';
import { ConfigModule } from '../../config/config.module.js';
import { MetricsController } from '../controllers/metrics.controller.js';
import { AgentStorage } from '../agents.storage.js';

import { McpController } from '../controllers/mcp.controller.js';

import { SupervisorService } from '../services/supervisor.service.js';
import AgentRuntimeManager from '../services/agent-runtime.manager.js';
import { AgentRuntimeOrchestrator } from '../services/agent-runtime.orchestrator.js';

@Module({
  imports: [ConfigModule],
  providers: [
    DatabaseService,
    AgentService,
    AgentStorage,
    SupervisorService,
    AgentRuntimeManager,
    AgentRuntimeOrchestrator,
  ],
  controllers: [AgentsController, MetricsController, McpController],

  exports: [
    DatabaseService,
    AgentService,
    AgentStorage,
    SupervisorService,
    AgentRuntimeManager,
  ],
})
export class AgentsModule {}
