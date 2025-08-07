// packages/server/src/agents.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  Delete,
} from '@nestjs/common';
import { AgentService } from '../services/agent.service.js';
import { AgentStorage } from '../agents.storage.js';
import {
  AgentDeleteRequestDTO,
  AgentRequestDTO,
  getMessagesFromAgentsDTO,
  AgentDeletesRequestDTO,
} from '../dto/agents.js';
import { Reflector } from '@nestjs/core';
import { ServerError } from '../utils/error.js';
import {
  logger,
  MessageFromAgentIdDTO,
  AgentAddRequestDTO,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
import { FastifyRequest } from 'fastify';
import { Postgres } from '@snakagent/database';
import { AgentConfigSQL } from '../interfaces/sql_interfaces.js';
import { SnakAgent } from '@snakagent/agents';

export interface AgentResponse {
  status: 'success' | 'failure' | 'waiting_for_human_input';
  data?: unknown;
}

export interface SupervisorRequestDTO {
  request: {
    content: string;
    agent_id?: string;
  };
}

export interface AgentAvatarResponseDTO {
  id: string;
  avatar_mime_type: string;
}

interface UpdateAgentMcpDTO {
  id: string;
  plugins: string[];
  mcpServers: Record<string, any>;
}

interface AgentMcpResponseDTO {
  id: string;
  mcpServers: Record<string, any>;
}

/**
 * Controller for handling agent-related operations
 */
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentStorage,
    private readonly reflector: Reflector
  ) {}
  /**
   * Handle user request to a specific agent
   * @param userRequest - The user request containing agent ID and content
   * @returns Promise<AgentResponse> - Response with status and data
   */
  @Post('update_agent_mcp')
  async updateAgentMcp(@Body() updateData: UpdateAgentMcpDTO) {
    try {
      const { id, mcpServers } = updateData;
      if (!id) {
        throw new BadRequestException('Agent ID is required');
      }

      if (!mcpServers || typeof mcpServers !== 'object') {
        throw new BadRequestException('MCP servers must be an object');
      }

      // Update agent MCP configuration in database
      const q = new Postgres.Query(
        `UPDATE agents
       SET "mcpServers" = $1
       WHERE id = $2
       RETURNING id, "mcpServers"`,
        [JSON.stringify(mcpServers), id]
      );

      const result = await Postgres.query<AgentMcpResponseDTO>(q);

      if (result.length === 0) {
        throw new BadRequestException('Agent not found');
      }
      const updatedAgent = result[0];

      return {
        status: 'success',
        data: {
          id: updatedAgent.id,
          mcpServers: updatedAgent.mcpServers,
        },
      };
    } catch (error) {
      logger.error('Error in updateAgentMcp:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('MCP update failed: ' + error.message);
    }
  }

  @Post('update_agent_config')
  async updateAgentConfig(@Body() config: AgentConfigSQL): Promise<any> {
    try {
      if (!config || !config.id) {
        throw new BadRequestException('Agent ID is required');
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      const updatableFields: (keyof AgentConfigSQL)[] = [
        'name',
        'group',
        'description',
        'lore',
        'objectives',
        'knowledge',
        'system_prompt',
        'interval',
        'plugins',
        'memory',
        'mode',
        'max_iterations',
      ];

      updatableFields.forEach((field) => {
        if (config[field] !== undefined && config[field] !== null) {
          if (field === 'memory') {
            const memoryData =
              typeof config[field] === 'string'
                ? JSON.parse(config[field])
                : config[field];

            const enabled =
              memoryData.enabled === 'true' || memoryData.enabled === true;
            const shortTermMemorySize = parseInt(
              memoryData.shortTermMemorySize
            );

            updateFields.push(
              `"memory" = ROW($${paramIndex}, $${paramIndex + 1})::memory`
            );
            values.push(enabled, shortTermMemorySize);
            paramIndex += 2;
          } else {
            updateFields.push(`"${String(field)}" = $${paramIndex}`);
            values.push(config[field]);
            paramIndex++;
          }
        }
      });

      if (updateFields.length === 0) {
        throw new BadRequestException('No valid fields to update');
      }

      values.push(config.id);

      const query = `
		UPDATE agents
		SET ${updateFields.join(', ')}
		WHERE id = $${paramIndex}
		RETURNING *
	  `;

      const q = new Postgres.Query(query, values);
      const result = await Postgres.query<AgentConfigSQL>(q);

      if (result.length === 0) {
        throw new BadRequestException('Agent not found');
      }

      return {
        status: 'success',
        data: result[0],
        message: 'Agent configuration updated successfully',
      };
    } catch (error) {
      logger.error('Error in updateAgentConfig:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Update failed: ' + error.message);
    }
  }

  @Post('upload-avatar')
  async uploadAvatar(
    @Headers('x-api-key') apiKey: string,
    @Req() req: FastifyRequest
  ) {
    try {
      const data = await (req as any).file();

      if (!data) {
        throw new BadRequestException('No file uploaded');
      }

      const buffer = await data.toBuffer();
      const mimetype = data.mimetype;

      const allowedMimeTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];
      if (!allowedMimeTypes.includes(data.mimetype)) {
        throw new BadRequestException(
          'Invalid file type. Only images are allowed.'
        );
      }

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxSize) {
        throw new BadRequestException('File too large. Maximum size is 5MB.');
      }

      const agentIdField = data.fields?.agent_id;
      let agentId: string | undefined;

      if (agentIdField) {
        if (Array.isArray(agentIdField)) {
          const firstField = agentIdField[0];
          if ('value' in firstField) {
            agentId = firstField.value as string;
          }
        } else {
          if ('value' in agentIdField) {
            agentId = agentIdField.value as string;
          }
        }
      }

      const q = new Postgres.Query(
        `UPDATE agents
			 SET avatar_image = $1, avatar_mime_type = $2
			 WHERE id = $3
			 RETURNING id, avatar_mime_type`,
        [buffer, mimetype, agentId]
      );

      const result = await Postgres.query<AgentAvatarResponseDTO>(q);

      if (result.length === 0) {
        throw new BadRequestException('Agent not found');
      }
      const avatarDataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;

      return {
        status: 'success',
        data: result[0],
        avatarUrl: avatarDataUrl,
      };
    } catch (error) {
      logger.error('Error in uploadAvatar:', error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Upload failed: ' + error.message);
    }
  }

  @Post('request')
  async handleUserRequest(
    @Body() userRequest: AgentRequestDTO
  ): Promise<AgentResponse> {
    try {
      const route = this.reflector.get('path', this.handleUserRequest);
      let agent: SnakAgent | undefined = undefined;
      if (userRequest.request.agent_id === undefined) {
        logger.warn(
          'Agent ID not provided in request, Using agent Selector to select agent'
        );
        const agentSelector = this.agentFactory.getAgentSelector();
        if (!agentSelector) {
          throw new ServerError('E01TA400');
        }
        agent = await agentSelector.execute(userRequest.request.content);
      } else {
        agent = this.agentFactory.getAgentInstance(
          userRequest.request.agent_id
        );
      }
      if (!agent) {
        throw new ServerError('E01TA400');
      }

      const messageRequest = {
        agent_id: agent.getAgentConfig().id.toString(),
        user_request: userRequest.request.content,
      };

      const action = this.agentService.handleUserRequest(agent, messageRequest);

      const response_metrics = await metrics.agentResponseTimeMeasure(
        messageRequest.agent_id.toString(),
        'key',
        route,
        action
      );

      const response: AgentResponse = {
        status: 'success',
        data: response_metrics,
      };
      logger.warn(JSON.stringify(action));
      return response;
    } catch (error) {
      logger.error('Error in handleUserRequest:', error);
      throw new ServerError('E03TA100');
    }
  }

  @Post('stop_agent')
  async stopAgent(
    @Body() userRequest: { agent_id: string }
  ): Promise<AgentResponse> {
    try {
      const agentConfig = this.agentFactory.getAgentInstance(
        userRequest.agent_id
      );
      if (!agentConfig) {
        throw new ServerError('E01TA400');
      }

      agentConfig.stop();
      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent_id} stopped and unregistered from supervisor`,
      };
      return response;
    } catch (error) {
      logger.error('Error in stopAgent:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Initialize and add a new agent
   * @param userRequest - Request containing agent configuration
   * @returns Promise<AgentResponse> - Response with status and confirmation message
   */
  @Post('init_agent')
  async addAgent(
    @Body() userRequest: AgentAddRequestDTO
  ): Promise<AgentResponse> {
    try {
      const newAgentConfig = await this.agentFactory.addAgent(
        userRequest.agent
      );

      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${newAgentConfig.name} added and registered with supervisor`,
      };

      metrics.agentConnect();

      return response;
    } catch (error) {
      logger.error('Error in addAgent:', error);
      throw new ServerError('E02TA200');
    }
  }

  /**
   * Get messages from a specific agent
   * @param userRequest - Request containing agent ID
   * @returns Promise<AgentResponse> - Response with agent messages
   */
  @Post('get_messages_from_agent')
  async getMessagesFromAgent(
    @Body() userRequest: MessageFromAgentIdDTO
  ): Promise<AgentResponse> {
    try {
      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id
      );
      if (!agentConfig) {
        throw new ServerError('E01TA400');
      }
      const messages =
        await this.agentService.getMessageFromAgentId(userRequest);
      const response: AgentResponse = {
        status: 'success',
        data: messages,
      };
      return response;
    } catch (error) {
      logger.error('Error in getMessagesFromAgent:', error);
      throw new ServerError('E04TA100');
    }
  }

  /**
   * Delete a specific agent
   * @param userRequest - Request containing agent ID to delete
   * @returns Promise<AgentResponse> - Response with deletion confirmation
   */
  @Post('delete_agent')
  async deleteAgent(
    @Body() userRequest: AgentDeleteRequestDTO
  ): Promise<AgentResponse> {
    try {
      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id
      );
      if (!agentConfig) {
        throw new ServerError('E01TA400');
      }

      await this.agentFactory.deleteAgent(userRequest.agent_id);

      const response: AgentResponse = {
        status: 'success',
        data: `Agent ${userRequest.agent_id} deleted and unregistered from supervisor`,
      };
      metrics.agentDisconnect();
      return response;
    } catch (error) {
      logger.error('Error in deleteAgent:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Delete multiple agents
   * @param userRequest - Request containing array of agent IDs to delete
   * @returns Promise<AgentResponse[]> - Array of responses for each deletion
   */
  @Post('delete_agents')
  async deleteAgents(
    @Body() userRequest: AgentDeletesRequestDTO
  ): Promise<AgentResponse[]> {
    try {
      const responses: AgentResponse[] = [];

      for (const agentId of userRequest.agent_id) {
        try {
          const agentConfig = this.agentFactory.getAgentConfig(agentId);
          if (!agentConfig) {
            responses.push({
              status: 'failure',
              data: `Agent ${agentId} not found`,
            });
            continue;
          }

          await this.agentFactory.deleteAgent(agentId);

          responses.push({
            status: 'success',
            data: `Agent ${agentId} deleted and unregistered from supervisor`,
          });
          metrics.agentDisconnect();
        } catch (error) {
          logger.error(`Error deleting agent ${agentId}:`, error);
          responses.push({
            status: 'failure',
            data: `Failed to delete agent ${agentId}: ${error.message}`,
          });
        }
      }

      return responses;
    } catch (error) {
      logger.error('Error in deleteAgents:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Get messages from multiple agents
   * @param userRequest - Request containing agent ID
   * @returns Promise<AgentResponse> - Response with messages from all agents
   */
  @Post('get_messages_from_agents')
  async getMessageFromAgentsId(
    @Body() userRequest: getMessagesFromAgentsDTO
  ): Promise<AgentResponse> {
    try {
      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id
      );
      if (!agentConfig) {
        logger.warn(`Agent ${userRequest.agent_id} not found`);
        throw new ServerError('E01TA400');
      }

      const messages = await this.agentService.getMessageFromAgentId({
        agent_id: userRequest.agent_id,
        limit_message: undefined,
      });

      const response: AgentResponse = {
        status: 'success',
        data: messages,
      };
      return response;
    } catch (error) {
      logger.error('Error in getMessageFromAgentsId:', error);
      throw new ServerError('E04TA100');
    }
  }

  @Delete('clear_message')
  async clearMessage(
    @Body() userRequest: getMessagesFromAgentsDTO
  ): Promise<AgentResponse> {
    try {
      const agentConfig = this.agentFactory.getAgentConfig(
        userRequest.agent_id
      );
      if (!agentConfig) {
        logger.warn(`Agent ${userRequest.agent_id} not found`);

        throw new ServerError('E01TA400');
      }

      const q = new Postgres.Query(`DELETE FROM message WHERE agent_id = $1`, [
        userRequest.agent_id,
      ]);
      await Postgres.query(q);
      const response: AgentResponse = {
        status: 'success',
        data: `Messages cleared for agent ${userRequest.agent_id}`,
      };
      return response;
    } catch (error) {
      logger.error('Error in clearMessage:', error);
      throw new ServerError('E04TA100');
    }
  }

  /**
   * Get all agents
   * @returns Promise<AgentResponse> - Response with all agents
   */
  @Get('get_agents')
  async getAgents(): Promise<AgentResponse> {
    try {
      const agents = await this.agentService.getAllAgents();
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      return response;
    } catch (error) {
      logger.error('Error in getAgents:', error);
      throw new ServerError('E06TA100');
    }
  }
  /**
   * Get agent status (alias for get_agents)
   * @returns Promise<AgentResponse> - Response with agents status
   */
  @Get('get_agent_status')
  async getAgentStatus(): Promise<AgentResponse> {
    try {
      const agents = await this.agentService.getAllAgents();
      if (!agents) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      return response;
    } catch (error) {
      logger.error('Error in getAgentStatus:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Get agent thread information (alias for get_agents)
   * @returns Promise<AgentResponse> - Response with agents thread data
   */
  @Get('get_agent_thread')
  async getAgentThread(): Promise<AgentResponse> {
    try {
      const agents = await this.agentService.getAllAgents();
      if (!agents) {
        throw new ServerError('E01TA400');
      }
      const response: AgentResponse = {
        status: 'success',
        data: agents,
      };
      return response;
    } catch (error) {
      logger.error('Error in getAgentThread:', error);
      throw new ServerError('E05TA100');
    }
  }

  /**
   * Health check endpoint
   * @returns Promise<AgentResponse> - Health status response
   */
  @Get('health')
  async getAgentHealth(): Promise<AgentResponse> {
    const response: AgentResponse = {
      status: 'success',
      data: 'Agent is healthy',
    };
    return response;
  }
}
