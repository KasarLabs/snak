import { Module } from '@nestjs/common';
import { AgentService } from './services/agent.service.js';
import { AgentsController } from './agents.controller.js';
import { ConfigModule } from '../config/config.module.js';
import { MetricsController } from './metrics.controller.js';
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
    AgentService,
    AgentStorage,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [AgentsController, MetricsController],
  exports: [AgentService, AgentStorage],
})
export class AgentsModule {}
