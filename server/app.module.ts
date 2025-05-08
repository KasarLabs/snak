import { Module } from '@nestjs/common';
import { AgentsModule } from './src/agents.module.js';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AgentResponseInterceptor } from './src/interceptors/response.js';
import { ApiKeyGuard } from './src/guard/ApikeyGuard.js';
import { ConfigModule } from './config/config.module.js';
import { CleanupModule } from './common/cleanup/cleanup.module.js';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [ConfigModule, AgentsModule, CleanupModule, 
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
    {
      provide: APP_INTERCEPTOR,
      useClass: AgentResponseInterceptor,
    },
  ],
})
export class AppModule {}