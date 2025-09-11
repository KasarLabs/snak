import { Module } from '@nestjs/common';
import { MyGateway } from './controllers/gateway.controller.js';
import { ConfigurationService } from '../config/configuration.js';
import { AgentsModule } from './agents.module.js';

@Module({
  imports: [AgentsModule],
  providers: [MyGateway, ConfigurationService],
})
export class GatewayModule {}
