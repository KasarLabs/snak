import { Module } from '@nestjs/common';
import { AgentService } from './services/agent.service';
import { AgentsController } from './agents.controller';
import { ConfigModule } from '../config/config.module';
import { WalletController } from './wallet.controller';
import { WalletService } from './services/wallet.service';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

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
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  controllers: [AgentsController, WalletController],
  exports: [AgentService, WalletService],
})
export class AgentsModule {}
