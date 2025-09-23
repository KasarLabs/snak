import { Module } from '@nestjs/common';
import { MyGateway } from '../controllers/gateway.controller.js';
import { ConfigModule } from '../../config/config.module.js';
import { AgentsModule } from './agents.module.js';

@Module({
  imports: [AgentsModule, ConfigModule],
  providers: [MyGateway],
})
export class GatewayModule {}
