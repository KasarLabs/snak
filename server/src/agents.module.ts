import { Module } from '@nestjs/common';
import { AgentService } from './services/agent.service.js';
import { AgentsController } from './agents.controller.js';
import { ConfigModule } from '../config/config.module.js';
import { MetricsController } from './metrics.controller.js';
import { WalletController } from './wallet.controller.js';
import { WalletService } from './services/wallet.service.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AgentFactory } from './agents.factory.js';
import { DatabaseController } from './database.controller.js';

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
    WalletService,
    AgentFactory,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [
    AgentsController,
    WalletController,
    DatabaseController,
    MetricsController,
  ],
  exports: [AgentService, WalletService, AgentFactory],
})
export class AgentsModule {}
