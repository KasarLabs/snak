import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration';
import {
  AgentCredentialsError,
  AgentExecutionError,
  AgentValidationError,
  StarknetTransactionError,
} from '../../common/errors';
import {
  IAgentService,
  AgentExecutionResponse,
} from '../interfaces/agent-service.interface';
import { IAgent } from '../interfaces/agent.interface';
import { AgentRequestDTO } from '../dto/agents';
import { IWalletService } from '../interfaces/wallet-service.inferface';

@Injectable()
export class WalletService implements IWalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly config: ConfigurationService) {}

  async handleUserCalldataRequest(
    agent: IAgent,
    userRequest: AgentRequestDTO
  ): Promise<any> {
    try {
      console.log('On y est ! ');
      const status = await this.getAgentStatus(agent);
      if (!status.isReady) {
        throw new AgentCredentialsError('Agent is not properly configured');
      }

      if (!(await agent.validateRequest(userRequest.request))) {
        throw new AgentValidationError('Invalid request format or parameters');
      }
      const result = await agent.execute(userRequest.request, true);
      console.log('Result API');
      return result;
    } catch (error: any) {
      return 'Error';
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
