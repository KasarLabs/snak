import { Injectable, Logger } from '@nestjs/common';

import {
  IAgentService,
  AgentExecutionResponse,
} from '../interfaces/agent-service.interface.js';
import { IAgent } from '../interfaces/agent.interface.js';
import { AgentRequestDTO } from '../dto/agents.js';
import {
  AgentValidationError,
  AgentCredentialsError,
  AgentExecutionError,
} from '../../common/errors/agent.errors.js';
import { ConfigurationService } from '../../config/configuration.js';
import { StarknetTransactionError } from '../../common/errors/starknet.errors.js';

@Injectable()
export class AgentService implements IAgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly config: ConfigurationService) {}

  async handleUserRequest(
    agent: IAgent,
    userRequest: AgentRequestDTO
  ): Promise<AgentExecutionResponse> {
    this.logger.debug({
      message: 'Processing agent request',
      request: userRequest.request,
    });

    try {
      const status = await this.getAgentStatus(agent);
      if (!userRequest || !userRequest.request) {
        throw new AgentValidationError('Missing required field: request');
      }
      if (!status.isReady) {
        throw new AgentCredentialsError('Agent is not properly configured');
      }
      if (!(await agent.validateRequest(userRequest.request))) {
        throw new AgentValidationError('Invalid request format or parameters');
      }
      if (!(await agent.validateRequest(userRequest.agentName))) {
        throw new AgentValidationError('Invalid request format or parameters');
      }

      console.log('Agent Request Starting...');
      const result = await agent.execute(userRequest.request);

      this.logger.debug({
        message: 'Agent request processed successfully',
        agentName: agent.getAgentConfig()?.name,
        agentInternalTools: agent.getAgentConfig()?.internal_plugins.join(','),
        result,
      });

      return {
        status: 'success',
        data: result,
      };
    } catch (error: any) {
      this.logger.error('Error processing agent request', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        request: userRequest.request,
      });

      if (error instanceof AgentValidationError) {
        throw error;
      }

      if (error.message?.includes('transaction')) {
        throw new StarknetTransactionError('Failed to execute transaction', {
          originalError: error.message,
          cause: error,
        });
      }

      throw new AgentExecutionError('Failed to process agent request', {
        originalError: error.message,
        cause: error,
      });
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
