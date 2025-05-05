import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.js';
import {
  AgentCredentialsError,
  AgentValidationError,
} from '../../common/errors/index.js';
import { IAgent } from '../interfaces/agent.interface.js';
import { AgentRequestDTO } from '../dto/agents.js';
import { IWalletService } from '../interfaces/wallet-service.inferface.js';

@Injectable()
export class WalletService implements IWalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly config: ConfigurationService) {}

  async handleUserCalldataRequest(
    agent: IAgent,
    userRequest: AgentRequestDTO
  ): Promise<any> {
    try {
      const status = await this.getAgentStatus(agent);
      if (!status.isReady) {
        throw new AgentCredentialsError('Agent is not properly configured');
      }

      if (!(await agent.validateRequest(userRequest.request))) {
        throw new AgentValidationError('Invalid request format or parameters');
      }
      const result = await agent.execute_call_data(userRequest.request);
      return result;
    } catch (error: any) {
      return error;
    }
  }

  async getAgentStatus(agent: IAgent): Promise<{
    isReady: boolean;
    walletConnected: boolean;
    apiKeyValid: boolean;
  }> {
    try {
      const credentials = agent.getAccountCredentials();

      // Check if the AI provider API keys are configured
      let apiKeyValid = false;
      try {
        this.config.ai;
        apiKeyValid = true;
      } catch (error) {
        this.logger.debug('AI API key validation failed', error);
      }

      return {
        isReady: Boolean(credentials && apiKeyValid),
        walletConnected: Boolean(credentials.accountPrivateKey),
        apiKeyValid,
      };
    } catch (error) {
      this.logger.error('Error checking agent status', error);
      return {
        isReady: false,
        walletConnected: false,
        apiKeyValid: false,
      };
    }
  }
}
