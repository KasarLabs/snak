import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.js';
import AgentRuntimeManager from './agent-runtime.manager.js';
import { AgentCfgInvalidationSubscriber } from './agent-cfg-invalidation.subscriber.js';

@Injectable()
export class AgentRuntimeOrchestrator implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentRuntimeOrchestrator.name);
  private subscriber: AgentCfgInvalidationSubscriber | null = null;

  constructor(
    private readonly runtimeManager: AgentRuntimeManager,
    private readonly configurationService: ConfigurationService
  ) {}

  async onModuleInit(): Promise<void> {
    const redisConfig = this.configurationService.redis;

    this.subscriber = new AgentCfgInvalidationSubscriber(this.runtimeManager, {
      redis: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password || undefined,
        db: redisConfig.db,
      },
    });

    try {
      await this.subscriber.start();
      this.logger.log('Agent runtime invalidation subscriber started');
    } catch (error) {
      this.logger.warn(
        'Failed to start agent runtime invalidation subscriber',
        { error }
      );
      this.subscriber = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    try {
      await this.subscriber.stop();
      this.logger.log('Agent runtime invalidation subscriber stopped');
    } catch (error) {
      this.logger.warn(
        'Error while stopping agent runtime invalidation subscriber',
        { error }
      );
    } finally {
      this.subscriber = null;
    }
  }
}

export default AgentRuntimeOrchestrator;
