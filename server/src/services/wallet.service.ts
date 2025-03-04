import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration';
import {
  AgentCredentialsError,
  AgentValidationError,
} from '../../common/errors';
import { IAgent } from '../interfaces/agent.interface';
import { AgentRequestDTO } from '../dto/agents';
import { IWalletService } from '../interfaces/wallet-service.inferface';
import Anthropic from '@anthropic-ai/sdk';
import { Model } from '@anthropic-ai/sdk/resources';

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
      const model = agent.getModelCredentials();

      return {
        isReady: Boolean(credentials && model.aiProviderApiKey),
        walletConnected: Boolean(credentials.accountPrivateKey),
        apiKeyValid: Boolean(model.aiProviderApiKey),
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
