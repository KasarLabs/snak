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
import { Reflector } from '@nestjs/core';
import { ServerError } from '../utils/error.js';
import {
  ResponseFormatter,
  HandleWithBadRequestPreservation,
  HandleErrors,
} from '../utils/error-handler.js';
import { ControllerHelpers } from '../utils/controller-helpers.js';
import {
  logger,
  MessageFromAgentIdDTO,
  AgentAddRequestDTO,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
import { FastifyRequest } from 'fastify';
import { Postgres } from '@snakagent/database';
import { SnakAgent } from '@snakagent/agents';

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
  @HandleWithBadRequestPreservation('MCP update failed')
  async updateAgentMcp(
    @Body() updateData: UpdateAgentMcpDTO,
    @Req() req: FastifyRequest
  ) {
    const { id, mcpServers } = updateData;

    if (!id) {
      throw new BadRequestException('Agent ID is required');
    }

    if (!mcpServers || typeof mcpServers !== 'object') {
      throw new BadRequestException('MCP servers must be an object');
    }

    const userId = ControllerHelpers.getUserId(req);

    // Update agent MCP configuration in database
    const q = new Postgres.Query(
      `UPDATE agents
       SET "mcpServers" = $1::jsonb
       WHERE id = $2 AND user_id = $3
       RETURNING id, "mcpServers"`,
      [mcpServers, id, userId]
    );

    const result = await Postgres.query<AgentMcpResponseDTO>(q);

    if (result.length === 0) {
      throw new BadRequestException('Agent not found');
    }
    const updatedAgent = result[0];

    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcpServers: updatedAgent.mcpServers,
    });
  }

  @Post('update_agent_config')
  @HandleWithBadRequestPreservation('Update failed')
  async updateAgentConfig(
    @Body() config: AgentConfigSQL,
    @Req() req: FastifyRequest
  ): Promise<any> {
    const userId = ControllerHelpers.getUserId(req);

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
      'mcpServers',
    ];

    updatableFields.forEach((field) => {
      if (config[field] !== undefined && config[field] !== null) {
        if (field === 'memory') {
          let memoryData;

          if (typeof config[field] === 'string') {
            const fieldValue = config[field] as string;
            if (fieldValue.startsWith('(') && fieldValue.endsWith(')')) {
              const content = fieldValue.slice(1, -1);
              const parts = content.split(',');
              memoryData = {
                enabled: parts[0] === 't' || parts[0] === 'true',
                shortTermMemorySize: parseInt(parts[1], 10),
                memorySize: parseInt(parts[2], 10),
              };
            } else {
              try {
                memoryData = JSON.parse(fieldValue);
              } catch (jsonError) {
                throw new BadRequestException(
                  `Invalid memory format: ${fieldValue}. Expected JSON or PostgreSQL composite type format.`
                );
              }
            }
          } else {
            memoryData = config[field];
          }

          const enabled =
            memoryData.enabled === 'true' ||
            memoryData.enabled === true ||
            memoryData.enabled === 't';
          const parsedShortTerm = Number.parseInt(
            String(memoryData.shortTermMemorySize ?? ''),
            10
          );
          if (Number.isNaN(parsedShortTerm)) {
            throw new BadRequestException(
              'memory.shortTermMemorySize must be a valid integer'
            );
          }

          const memorySize = parseInt(memoryData.memorySize) || 20;

          updateFields.push(
            `"memory" = ROW($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})::memory`
          );
          values.push(enabled, parsedShortTerm, memorySize);
          paramIndex += 3;
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
    values.push(userId);

    const query = `
		UPDATE agents
		SET ${updateFields.join(', ')}
		WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
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
  }

  @Post('upload-avatar')
  @HandleWithBadRequestPreservation('Upload failed')
  async uploadAvatar(
    @Headers('x-api-key') apiKey: string,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);

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
			 WHERE id = $3 AND user_id = $4
			 RETURNING id, avatar_mime_type`,
      [buffer, mimetype, agentId, userId]
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
  }

  @Post('request')
  @HandleErrors('E03TA100')
  async handleUserRequest(
    @Body() userRequest: AgentRequestDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const userId = ControllerHelpers.getUserId(req);

    const route = this.reflector.get('path', this.handleUserRequest);
    let agent: SnakAgent | undefined = undefined;
    if (userRequest.request.agent_id === undefined) {
      logger.info(
        'Agent ID not provided in request, Using agent Selector to select agent'
      );

      const agentSelector = this.agentFactory.getAgentSelector();
      agent = await agentSelector.execute(userRequest.request.content, false, {
        userId,
      });
      if (agent) {
        const agentId = agent.getAgentConfig().id;
        ControllerHelpers.verifyAgentConfigOwnership(
          this.agentFactory,
          agentId,
          userId
        );
      }
    } else {
      agent = ControllerHelpers.verifyAgentOwnership(
        this.agentFactory,
        userRequest.request.agent_id,
        userId
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

    const response: AgentResponse = ResponseFormatter.success(response_metrics);
    return response;
  }

  @Post('stop_agent')
  @HandleErrors('E05TA100')
  async stopAgent(
    @Body() userRequest: { agent_id: string },
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const { userId, agent } = ControllerHelpers.getUserAndVerifyAgentOwnership(
      req,
      this.agentFactory,
      userRequest.agent_id
    );

    agent.stop();
    return ResponseFormatter.success(
      `Agent ${userRequest.agent_id} stopped and unregistered from supervisor`
    );
  }

  /**
   * Initialize and add a new agent
   * @param userRequest - Request containing agent configuration
   * @returns Promise<AgentResponse> - Response with status and confirmation message
   */
  @Post('init_agent')
  @HandleErrors('E02TA200')
  async addAgent(
    @Body() userRequest: AgentAddRequestDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const userId = ControllerHelpers.getUserId(req);

    const newAgentConfig = await this.agentFactory.addAgent({
      ...userRequest.agent,
      user_id: userId,
    });

    metrics.agentConnect();

    return ResponseFormatter.success(
      `Agent ${newAgentConfig.name} added and registered with supervisor`
    );
  }

  /**
   * Get messages from a specific agent
   * @param userRequest - Request containing agent ID
   * @returns Promise<AgentResponse> - Response with agent messages
   */
  @Post('get_messages_from_agent')
  @HandleErrors('E04TA100')
  async getMessagesFromAgent(
    @Body() userRequest: MessageFromAgentIdDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const { userId } = ControllerHelpers.getUserAndVerifyAgentConfigOwnership(
      req,
      this.agentFactory,
      userRequest.agent_id
    );

    const messages = await this.agentService.getMessageFromAgentId(
      userRequest,
      userId
    );
    return ResponseFormatter.success(messages);
  }

  /**
   * Delete a specific agent
   * @param userRequest - Request containing agent ID to delete
   * @returns Promise<AgentResponse> - Response with deletion confirmation
   */
  @Post('delete_agent')
  @HandleErrors('E05TA100')
  async deleteAgent(
    @Body() userRequest: AgentDeleteRequestDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const { userId } = ControllerHelpers.getUserAndVerifyAgentConfigOwnership(
      req,
      this.agentFactory,
      userRequest.agent_id
    );

    await this.agentFactory.deleteAgent(userRequest.agent_id, userId);
    metrics.agentDisconnect();

    return ResponseFormatter.success(
      `Agent ${userRequest.agent_id} deleted and unregistered from supervisor`
    );
  }

  /**
   * Delete multiple agents
   * @param userRequest - Request containing array of agent IDs to delete
   * @returns Promise<AgentResponse[]> - Array of responses for each deletion
   */
  @Post('delete_agents')
  @HandleErrors('E05TA100')
  async deleteAgents(
    @Body() userRequest: AgentDeletesRequestDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse[]> {
    const userId = ControllerHelpers.getUserId(req);
    const responses: AgentResponse[] = [];

    for (const agentId of userRequest.agent_id) {
      try {
        ControllerHelpers.verifyAgentConfigOwnership(
          this.agentFactory,
          agentId,
          userId
        );
        await this.agentFactory.deleteAgent(agentId, userId);

        responses.push(
          ResponseFormatter.success(
            `Agent ${agentId} deleted and unregistered from supervisor`
          )
        );
        metrics.agentDisconnect();
      } catch (error) {
        logger.error(`Error deleting agent ${agentId}:`, error);
        responses.push(
          ResponseFormatter.failure(
            `Failed to delete agent ${agentId}: ${error.message}`
          )
        );
      }
    }

    return responses;
  }

  /**
   * Get messages from multiple agents
   * @param userRequest - Request containing agent ID
   * @returns Promise<AgentResponse> - Response with messages from all agents
   */
  @Post('get_messages_from_agents')
  @HandleErrors('E04TA100')
  async getMessageFromAgentsId(
    @Body() userRequest: getMessagesFromAgentsDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const { userId } = ControllerHelpers.getUserAndVerifyAgentConfigOwnership(
      req,
      this.agentFactory,
      userRequest.agent_id
    );

    const messages = await this.agentService.getMessageFromAgentId(
      {
        agent_id: userRequest.agent_id,
        thread_id: userRequest.thread_id,
        limit_message: undefined,
      },
      userId
    );

    return ResponseFormatter.success(messages);
  }

  @Delete('clear_message')
  @HandleErrors('E04TA100')
  async clearMessage(
    @Body() userRequest: getMessagesFromAgentsDTO,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    const { userId } = ControllerHelpers.getUserAndVerifyAgentConfigOwnership(
      req,
      this.agentFactory,
      userRequest.agent_id
    );

    const q = new Postgres.Query(
      `DELETE FROM message m
       USING agents a 
       WHERE m.agent_id = a.id 
       AND m.agent_id = $1 
       AND a.user_id = $2`,
      [userRequest.agent_id, userId]
    );
    await Postgres.query(q);

    return ResponseFormatter.success(
      `Messages cleared for agent ${userRequest.agent_id}`
    );
  }

  /**
   * Get all agents
   * @returns Promise<AgentResponse> - Response with all agents
   */
  @Get('get_agents')
  @HandleErrors('E06TA100')
  async getAgents(@Req() req: FastifyRequest): Promise<AgentResponse> {
    const userId = ControllerHelpers.getUserId(req);
    const agents = await this.agentService.getAllAgentsOfUser(userId);
    return ResponseFormatter.success(agents);
  }
  /**
   * Get agent status (alias for get_agents)
   * @returns Promise<AgentResponse> - Response with agents status
   */
  @Get('get_agent_status')
  @HandleErrors('E05TA100')
  async getAgentStatus(@Req() req: FastifyRequest): Promise<AgentResponse> {
    const userId = ControllerHelpers.getUserId(req);
    const agents = await this.agentService.getAllAgentsOfUser(userId);

    if (!agents) {
      throw new ServerError('E01TA400');
    }

    return ResponseFormatter.success(agents);
  }

  /**
   * Get agent thread information (alias for get_agents)
   * @returns Promise<AgentResponse> - Response with agents thread data
   */
  @Get('get_agent_thread')
  @HandleErrors('E05TA100')
  async getAgentThread(@Req() req: FastifyRequest): Promise<AgentResponse> {
    const userId = ControllerHelpers.getUserId(req);
    const agents = await this.agentService.getAllAgentsOfUser(userId);

    if (!agents) {
      throw new ServerError('E01TA400');
    }

    return ResponseFormatter.success(agents);
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
