import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigurationService } from './configuration';

@Module({
  imports: [
    NestConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigModule {}
