import { Module } from '@nestjs/common';
import { AgentsModule } from './src/agents.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AgentResponseInterceptor } from './src/interceptors/response';
import { ApiKeyGuard } from './src/guard/ApikeyGuard';
import { ConfigModule } from './config/config.module';
import { CleanupModule } from './common/cleanup/cleanup.module';

@Module({
  imports: [ConfigModule, AgentsModule, CleanupModule],
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
