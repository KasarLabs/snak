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
import { redisAgents } from '@snakagent/database/queries';

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
      request: userRequest.request,
    });
    try {
      let result: any;

      if (agent && typeof agent.execute === 'function') {
        const user_request: UserRequest = {
          request: userRequest.request || '',
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

  async *handleUserRequestWebsocket(
    agent: SnakAgent,
    userRequest: MessageRequest,
    userId: string
  ): AsyncGenerator<ChunkOutput> {
    this.logger.debug({
      message: 'Processing agent request',
      request: userRequest.request,
    });
    try {
      const user_request: UserRequest = {
        request: userRequest.request || '',
        hitl_threshold: userRequest.hitl_threshold ?? undefined,
      };
      for await (const chunk of agent.execute(user_request)) {
        if (chunk.metadata.final === true) {
          this.logger.debug('SupervisorService: Execution completed');
          yield chunk;
          return;
        }
        yield chunk;
      }
    } catch (error: any) {
      this.logger.error('Error processing agent request', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        request: userRequest,
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

  async getAllAgentsOfUser(
    userId: string
  ): Promise<AgentConfig.OutputWithoutUserId[]> {
    try {
      const q = new Postgres.Query(
        `
			SELECT
			  id,
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
      const res = await Postgres.query<AgentConfig.OutputWithoutUserId>(q);
      return res;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  /**
   * Get all agents for a user from Redis
   * @param userId - User ID to fetch agents for
   * @returns Promise<AgentConfig.OutputWithoutUserId[]> - Array of agent configurations from Redis without user_id
   */
  async getAllAgentsOfUserFromRedis(
    userId: string
  ): Promise<AgentConfig.OutputWithoutUserId[]> {
    try {
      const agents = await redisAgents.listAgentsByUser(userId);

      // Remove user_id from each agent to match the PostgreSQL behavior
      const agentsWithoutUserId = agents.map((agent) => {
        const { user_id, ...agentWithoutUserId } = agent;
        return agentWithoutUserId;
      });

      return agentsWithoutUserId;
    } catch (error) {
      this.logger.error('Error fetching agents from Redis:', error);
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

  async updateModelsConfig(model: UpdateModelConfigDTO, userId: string) {
    try {
      const q = new Postgres.Query(
        `UPDATE models_config SET model = ROW($1, $2, $3, $4)::model_config WHERE user_id = $5`,
        [
          model.provider,
          model.modelName,
          model || 0.7,
          model.maxTokens || 4096,
          userId,
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
