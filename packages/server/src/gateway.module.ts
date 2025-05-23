import { Module } from '@nestjs/common';
import { MyGateway } from './controllers/gateway.controller.js';
import { AgentService } from './services/agent.service.js';
import { AgentStorage } from './agents.storage.js';
import { ConfigurationService } from '../config/configuration.js';
import { AgentsModule } from './agents.module.js';

@Module({
  imports: [AgentsModule],
  providers: [MyGateway, AgentService, AgentStorage, ConfigurationService],
})
export class GatewayModule {}
