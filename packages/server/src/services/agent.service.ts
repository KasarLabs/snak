import { Injectable, Logger } from '@nestjs/common';

import {
  IAgentService,
  AgentExecutionResponse,
} from '../interfaces/agent-service.interface.js';
import { IAgent } from '../interfaces/agent.interface.js';
import {
  MessageFromAgentIdDTO,
  MessageRequest,
  UpdateModelConfigDTO,
} from '@snakagent/core';
import {
  AgentValidationError,
  AgentExecutionError,
} from '../../common/errors/agent.errors.js';
import { ConfigurationService } from '../../config/configuration.js';
import { StarknetTransactionError } from '../../common/errors/starknet.errors.js';
import { Postgres } from '@snakagent/database';
import { AgentConfigSQL, MessageSQL } from '../interfaces/sql_interfaces.js';

@Injectable()
export class AgentService implements IAgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly config: ConfigurationService) {}

  async handleUserRequest(
    agent: IAgent,
    userRequest: MessageRequest
  ): Promise<AgentExecutionResponse> {
    this.logger.debug({
      message: 'Processing agent request',
      request: userRequest.user_request,
    });
    try {
      let result: any;

      if (agent && typeof agent.execute === 'function') {
        const executionResult = agent.execute(userRequest.user_request);

        function isAsyncGenerator(
          obj: any
        ): obj is AsyncGenerator<any, any, any> {
          return (
            obj &&
            typeof obj === 'object' &&
            typeof obj[Symbol.asyncIterator] === 'function'
          );
        }

        if (isAsyncGenerator(executionResult)) {
          for await (const chunk of executionResult) {
            if (chunk.final === true) {
              this.logger.debug('SupervisorService: Execution completed');
              result = chunk;
              break;
            }
            result = chunk;
          }
        } else {
          // If it's a Promise, just await the result
          result = await executionResult;
        }
      } else {
        throw new Error('Invalid agent: missing execute method');
      }

      this.logger.debug({
        message: 'Agent request processed successfully',
        result: result,
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
        request: userRequest.user_request,
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

  async *handleUserRequestWebsocket(
    agent: any,
    userRequest: MessageRequest
  ): AsyncGenerator<any> {
    this.logger.debug({
      message: 'Processing agent request',
      request: userRequest.user_request,
    });
    try {
      const q = new Postgres.Query(
        `SELECT status, id 
     FROM message 
     WHERE agent_id = $1
     ORDER BY created_at DESC
     LIMIT 1;`,
        [userRequest.agent_id]
      );
      const status = await Postgres.query<{ status: string; id: string }>(q);
      if (
        status &&
        status.length != 0 &&
        status[0].status === 'waiting_for_human_input'
      ) {
        for await (const chunk of agent.execute(
          userRequest.user_request,
          true
        )) {
          if (chunk.final === true) {
            this.logger.debug('SupervisorService: Execution completed');
            yield chunk;

            const q = new Postgres.Query(
              `UPDATE message 
              SET status = $1 
              WHERE id = $2;`,
              ['success', status[0].id]
            );
            await Postgres.query(q);
            return;
          }
          yield chunk;
        }
      } else {
        for await (const chunk of agent.execute(
          userRequest.user_request,
          false
        )) {
          if (chunk.final === true) {
            this.logger.debug('SupervisorService: Execution completed');
            yield chunk;
            return;
          }
          yield chunk;
        }
      }
    } catch (error: any) {
      this.logger.error('Error processing agent request', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        request: userRequest.user_request,
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

  async getAllAgents(): Promise<AgentConfigSQL[]> {
    try {
      const q = new Postgres.Query(`
			SELECT
			  id, name, "group", description, lore, objectives, knowledge,
			  system_prompt, interval, plugins, memory, mode, max_iterations,
			  "mcpServers",
			  CASE
				WHEN avatar_image IS NOT NULL AND avatar_mime_type IS NOT NULL
				THEN CONCAT('data:', avatar_mime_type, ';base64,', encode(avatar_image, 'base64'))
				ELSE NULL
			  END as "avatarUrl",
			  avatar_mime_type
			FROM agents
		  `);
      const res = await Postgres.query<AgentConfigSQL>(q);
      this.logger.debug(`All agents:', ${JSON.stringify(res)} `);
      return res;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async getMessageFromAgentId(
    userRequest: MessageFromAgentIdDTO
  ): Promise<MessageSQL[]> {
    try {
      const limit = userRequest.limit_message || 10;
      const q = new Postgres.Query(
        `SELECT * FROM message WHERE agent_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
        [userRequest.agent_id, limit]
      );
      const res = await Postgres.query<MessageSQL>(q);
      // this.logger.debug(`All messages:', ${JSON.stringify(res)} `);
      return res;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async updateModelsConfig(model: UpdateModelConfigDTO) {
    try {
      const q = new Postgres.Query(
        `UPDATE models_config SET provider = $1, model_name = $2, description = $3 WHERE id = 1`,
        [model.provider, model.model_name, model.description]
      );
      const res = await Postgres.query(q);
      this.logger.debug(`Models config updated:', ${JSON.stringify(res)} `);
    } catch (error) {
      this.logger.error(error);
      throw error;
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
        const aiConfig = this.config.ai;
        apiKeyValid = Boolean(aiConfig && aiConfig.apiKey);
      } catch (error) {
        this.logger.debug('AI API key verification failed', error);
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
