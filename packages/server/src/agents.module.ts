import { Module } from '@nestjs/common';
import { AgentService } from './services/agent.service.js';
import { SupervisorService } from './services/supervisor.service.js';
import { DatabaseService } from './services/database.service.js';
import { AgentsController } from './controllers/agents.controller.js';
import { ConfigModule } from '../config/config.module.js';
import { MetricsController } from './controllers/metrics.controller.js';

import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AgentStorage } from './agents.storage.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 5,
      },
    ]),
  ],
  providers: [
    DatabaseService,
    AgentService,
    AgentStorage,
    SupervisorService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [AgentsController, MetricsController],
  exports: [DatabaseService, AgentService, SupervisorService, AgentStorage],
})
export class AgentsModule {}
