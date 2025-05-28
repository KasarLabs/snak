import { Module } from '@nestjs/common';
import { AgentsModule } from './src/agents.module.js';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './src/guard/ApikeyGuard.js';
import { ConfigModule } from './config/config.module.js';
import { CleanupModule } from './common/cleanup/cleanup.module.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { GatewayModule } from './src/gateway.module.js';
import { TwilioWebhookModule } from '@snakagent/plugin-twilio';

@Module({
  imports: [
    AgentsModule,
    GatewayModule,
    ConfigModule,
    CleanupModule,
    TwilioWebhookModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    // TODO add interceptor for agent response
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: AgentResponseInterceptor,
    // },
    // TODO add interceptor for agent response
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: AgentResponseInterceptor,
    // },
  ],
})
export class AppModule {}
