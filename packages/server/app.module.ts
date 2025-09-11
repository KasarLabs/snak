import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiKeyGuard } from './src/guard/ApikeyGuard.js';
import { ConfigModule } from './config/config.module.js';
import { CleanupModule } from './common/cleanup/cleanup.module.js';
import { ThrottlerModule } from '@nestjs/throttler';
import { GatewayModule } from './src/modules/gateway.module.js';
import { FileIngestionModule } from './src/modules/file-ingestion.module.js';
import { WorkersModule } from './src/modules/workers.module.js';

@Module({
  imports: [
    GatewayModule,
    ConfigModule,
    CleanupModule,
    FileIngestionModule,
    WorkersModule,
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
