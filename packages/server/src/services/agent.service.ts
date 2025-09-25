import { Injectable, Logger } from '@nestjs/common';

import {
  IAgentService,
  AgentExecutionResponse,
} from '../interfaces/agent-service.interface.js';
import { IAgent } from '../interfaces/agent.interface.js';
import {
  AgentConfig,
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
import {
  ChunkOutput,
  EventType,
  SnakAgent,
  UserRequest,
} from '@snakagent/agents';

@Injectable()
export class AgentService implements IAgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly config: ConfigurationService) {}

  async handleUserRequest(
    agent: SnakAgent,
    userRequest: MessageRequest
  ): Promise<AgentExecutionResponse> {
    this.logger.debug({
      message: 'Processing agent request',
      request: userRequest.user_request,
    });
    try {
      let result: any;

      if (agent && typeof agent.execute === 'function') {
        const user_request: UserRequest = {
          request: userRequest.user_request || '',
          hitl_threshold: userRequest.hitl_threshold ?? undefined,
        };
        const executionResult = agent.execute(user_request);

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
            if (chunk.metadata.final === true) {
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
    userRequest: MessageRequest,
    userId: string
  ): AsyncGenerator<ChunkOutput> {
    this.logger.debug({
      message: 'Processing agent request',
      request: userRequest.user_request,
    });
    try {
      const q = new Postgres.Query(
        `SELECT m.event, m.id 
     FROM message m
     INNER JOIN agents a ON m.agent_id = a.id
     WHERE m.agent_id = $1 AND a.user_id = $2
     ORDER BY m.created_at DESC
     LIMIT 1;`,
        [userRequest.agent_id, userId]
      );
      const result = await Postgres.query<{ event: EventType; id: string }>(q);
      if (
        result &&
        result.length != 0 &&
        result[0].event === EventType.ON_GRAPH_INTERRUPTED
      ) {
        for await (const chunk of agent.execute(
          userRequest.user_request,
          true
        )) {
          if (chunk.final === true) {
            this.logger.debug('SupervisorService: Execution completed');
            yield chunk;
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

  async getAllAgentsOfUser(userId: string): Promise<AgentConfig.InputWithId[]> {
    try {
      const q = new Postgres.Query(
        `
			SELECT
			  id, user_id,
			  row_to_json(profile) as profile,
			  mcp_servers as "mcp_servers",
			  prompts_id,
			  row_to_json(graph) as graph,
			  row_to_json(memory) as memory,
			  row_to_json(rag) as rag,
			  CASE
				WHEN avatar_image IS NOT NULL AND avatar_mime_type IS NOT NULL
				THEN CONCAT('data:', avatar_mime_type, ';base64,', encode(avatar_image, 'base64'))
				ELSE NULL
			  END as "avatarUrl",
			  avatar_mime_type,
			  created_at,
			  updated_at
			FROM agents
      WHERE user_id = $1
		  `,
        [userId]
      );
      const res = await Postgres.query<AgentConfig.InputWithId>(q);
      this.logger.debug(`All agents:', ${JSON.stringify(res)} `);
      return res;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async getMessageFromAgentId(
    userRequest: MessageFromAgentIdDTO,
    userId: string
  ): Promise<ChunkOutput[]> {
    try {
      const limit = userRequest.limit_message || 10;
      const q = new Postgres.Query(
        `SELECT * FROM get_messages_optimized($1::UUID,$2,$3::UUID,$4,$5,$6)`,
        [userRequest.agent_id, userRequest.thread_id, userId, false, limit, 0]
      );
      const res = await Postgres.query<ChunkOutput>(q);
      this.logger.debug(`All messages:', ${JSON.stringify(res)} `);
      return res;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async updateModelsConfig(model: UpdateModelConfigDTO) {
    try {
      const q = new Postgres.Query(
        `UPDATE models_config SET model = ROW($1, $2, $3, $4)::model_config WHERE user_id = $5`,
        [
          model.provider,
          model.modelName,
          model || 0.7,
          model.maxTokens || 4096,
          'default-user',
        ]
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
      let apiKeyValid = true; // TODO add actual check for API key validity on the agent model
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
