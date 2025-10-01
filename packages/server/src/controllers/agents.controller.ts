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
  AgentRequestDTO,
  AgentConfig,
  AgentResponse,
  AgentDeleteRequestDTO,
  AgentDeletesRequestDTO,
  getMessagesFromAgentsDTO,
  MessageRequest,
  GetAgentMcpsRequestDTO,
  GetMcpSecretsRequestDTO,
  UpdateMcpSecretNameRequestDTO,
  UpdateMcpSecretValueRequestDTO,
  UpdateMcpConfigRequestDTO,
} from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
import { FastifyRequest } from 'fastify';
import { Postgres } from '@snakagent/database';
import { SnakAgent } from '@snakagent/agents';
import { agent } from 'supertest';

export interface SupervisorRequestDTO {
  request: {
    content: string;
    agent_id?: string;
  };
}

interface AgentAvatarResponseDTO {
  id: string;
  avatar_mime_type: string;
}

interface UpdateAgentMcpDTO {
  id: string;
  mcp_servers: Record<string, any>;
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
   * Retrieve MCP configurations (mcp_servers column) 
   * for all agents belonging to the current user.
   *
   * @param req - HTTP request containing the authenticated userId
   * @returns  { agent_id: string, mcp_servers: Record<string, any> } 
   */
  @Get('get_user_mcps')
  @HandleErrors('E01MCP100')
  async getUserMcps(@Req() req: FastifyRequest) {
    const userId = ControllerHelpers.getUserId(req);

    const q = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE user_id = $1 ORDER BY created_at ASC',
      [userId]
    );

    const agents = await Postgres.query<UpdateAgentMcpDTO>(q);

    return ResponseFormatter.success(
      agents.map((agent: { id: any; mcp_servers: Record<string, any>; }) => ({
        agent_id: agent.id,
        mcp_servers: agent.mcp_servers ?? {}, // Default to empty object if null
      }))
    );
  }

  /**
   * Retrieve MCP configuration
   * for a single agent belonging to the current user.
   *
   * @param body - Contains agent_id of the agent to fetch
   * @returns Object with agent_id and its mcp_servers configuration
   */
  @Post('get_agent_mcps')
  @HandleErrors('E02MCP100')
  async getAgentMcps(
    @Body() body: GetAgentMcpsRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId } = body;

    const q = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(q);

    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const agent = agents[0];

    return ResponseFormatter.success({
      agent_id: agent.id,
      mcp_servers: agent.mcp_servers ?? {}, 
    });
  }

  /**
   * Retrieve mcp secret for one agent and one mcp for a given user.
   * @param { agent_id, mcp_id }. - IDs of the agent and MCP to fetch secrets
   * @returns secret_key: secret_value
   */
  @Post('get_mcp_secrets')
  @HandleErrors('E03MCP100')
  async getMcpSecrets(
    @Body() body: GetMcpSecretsRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId } = body;

    const q = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(q);

    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const mcp_servers = agents[0].mcp_servers;
    const mcpConfig = mcp_servers[mcpId];

    if (!mcpConfig || typeof mcpConfig !== 'object') {
      throw new BadRequestException('MCP server not found');
    }

    const env =
      mcpConfig.env && typeof mcpConfig.env === 'object'
        ? (mcpConfig.env as Record<string, any>)
        : {};

    return ResponseFormatter.success(env);

  }

  /**
   * Update mcp secret for one agent and one mcp for a given user.
   * @param { agent_id, mcp_id }. - IDs of the agent and MCP to fetch secrets
   * @returns secret_key: secret_value
   */
  @Post('update_mcp_secret_value')
  @HandleWithBadRequestPreservation('MCP secret update failed')
  async updateMcpSecretValue(
    @Body() body: UpdateMcpSecretValueRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, secret_name, secret_value } = body;

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );

    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);

    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];

    if (!currentConfig || typeof currentConfig !== 'object') {
      throw new BadRequestException('MCP server not found');
    }

    const env =
      currentConfig.env && typeof currentConfig.env === 'object'
        ? { ...currentConfig.env }
        : {};

    env[secret_name] = secret_value; // <-- update value of given key

    const updatedServers = {
      ...currentServers,
      [mcpId]: {
        ...currentConfig,
        env,
      },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);

    if (result.length === 0) {
      throw new BadRequestException('Failed to update MCP secret');
    }

    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: result[0].mcp_servers,
    });
  }

  /**
   * Update mcp secret name for one agent and one mcp for a given user.
   * @param { agent_id, mcp_id, old_name, new_name }. - IDs of the agent and MCP to fetch secrets
   * @returns secret_key: secret_value
   */
  @Post('update_mcp_secret_name')
  @HandleWithBadRequestPreservation('MCP secret rename failed')
  async renameMcpSecret(
    @Body() body: UpdateMcpSecretNameRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, old_name, new_name } =
      body;

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );

    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);

    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];

    if (!currentConfig || typeof currentConfig !== 'object') {
      throw new BadRequestException('MCP server not found');
    }

    const env =
      currentConfig.env && typeof currentConfig.env === 'object'
        ? { ...currentConfig.env }
        : {};

    if (!(old_name in env)) {
      throw new BadRequestException(
        `Secret key "${old_name}" does not exist`
      );
    }

    // move value to new key and delete old
    env[new_name] = env[old_name];
    delete env[old_name];

    const updatedServers = {
      ...currentServers,
      [mcpId]: {
        ...currentConfig,
        env,
      },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);

    if (result.length === 0) {
      throw new BadRequestException('Failed to rename MCP secret');
    }

    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: result[0].mcp_servers,
    });
  }

  /**
   * Delete a secret from one MCP server of a given agent.
   * @param { agent_id, mcp_id, secret_name }
   * @returns Updated mcp_servers config
   */
  @Post('delete_mcp_secret')
  @HandleWithBadRequestPreservation('MCP secret delete failed')
  async deleteMcpSecret(
    @Body() body: { agent_id: string; mcp_id: string; secret_name: string },
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, secret_name } = body;

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );

    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];

    if (!currentConfig || typeof currentConfig !== 'object') {
      throw new BadRequestException('MCP server not found');
    }

    const env = { ...(currentConfig.env ?? {}) };
    if (!(secret_name in env)) {
      throw new BadRequestException(`Secret key "${secret_name}" not found`);
    }
    delete env[secret_name];

    const updatedServers = {
      ...currentServers,
      [mcpId]: {
        ...currentConfig,
        env,
      },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    return ResponseFormatter.success(result[0]);
  }

  /**
   * Delete one MCP server configuration from an agent.
   * @param { agent_id, mcp_id }
   * @returns Updated mcp_servers config
   */
  @Post('delete_mcp_server')
  @HandleWithBadRequestPreservation('MCP server delete failed')
  async deleteMcpServer(
    @Body() body: { agent_id: string; mcp_id: string },
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId } = body;

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );

    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const currentServers = agents[0].mcp_servers ?? {};
    if (!(mcpId in currentServers)) {
      throw new BadRequestException(`MCP server "${mcpId}" not found`);
    }

    delete currentServers[mcpId];

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [currentServers, agentId, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    return ResponseFormatter.success(result[0]);

  }

    /**
   * Delete multiple MCP servers from an agent.
   * @param { agent_id, mcp_ids[] }
   * @returns Updated mcp_servers config
   */
  @Post('delete_multiple_mcp_server')
  @HandleWithBadRequestPreservation('MCP servers delete failed')
  async deleteMcpServers(
    @Body() body: { agent_id: string; mcp_ids: string[] },
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_ids } = body;

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );

    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const currentServers = agents[0].mcp_servers ?? {};
    for (const mcpId of mcp_ids) {
      delete currentServers[mcpId];
    }

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [currentServers, agentId, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    return ResponseFormatter.success(result[0]);
  }

  /**
   * Delete all MCP servers for an agent.
   * @param { agent_id }
   * @returns { mcp_servers = {} }
   */
  @Post('delete_all_mcp_servers')
  @HandleWithBadRequestPreservation('Delete all MCP servers failed')
  async deleteAllMcpServers(
    @Body() body: { agent_id: string },
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId } = body;

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [{}, agentId, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    if (result.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    return ResponseFormatter.success(result[0]);
  }

  /**
   * Add a new MCP server to an agent and start it immediately.
   * @param { agent_id, mcp_id, config } 
   * - agent_id: UUID of the agent
   * - mcp_id: identifier for the new MCP server
   * - config: MCP server config { command, args, env }
   * @returns updated agent with mcp_servers
   */
  @Post('add_mcp_server')
  @HandleWithBadRequestPreservation('MCP server addition failed')
  async addMcpServer(
    @Body() body: { agent_id: string; mcp_id: string; config: Record<string, any> },
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, config } = body;

    // Validate input
    if (!agentId || !mcpId || !config) {
      throw new BadRequestException('agent_id, mcp_id and config are required');
    }

    // Fetch agent
    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) {
      throw new BadRequestException('Agent not found');
    }

    const currentServers = agents[0].mcp_servers ?? {};

    if (currentServers[mcpId]) {
      throw new BadRequestException(`MCP server "${mcpId}" already exists`);
    }

    // Add the new server config
    const updatedServers = {
      ...currentServers,
      [mcpId]: config,
    };

    // Persist in DB
    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    if (result.length === 0) {
      throw new BadRequestException('Failed to add MCP server');
    }

    // // ⚡ Start the MCP server process
    // try {
    //   // You might replace this with a proper MCP manager service
    //   const { command, args, env } = config;
    //   const { spawn } = await import('child_process');
    //   const proc = spawn(command, args, { env: { ...process.env, ...env } });
    //   proc.on('error', (err) =>
    //     logger.error(`Failed to start MCP server ${mcpId}: ${err.message}`)
    //   );
    //   logger.info(`MCP server ${mcpId} started for agent ${agentId}`);
    // } catch (err) {
    //   logger.error('Error while launching MCP server', err);
    //   // Note: the MCP is stored, but the process might not be running
    // }

    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: result[0].mcp_servers,
    });
  }



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
    logger.info('update_agent_mcp called');
    const userId = ControllerHelpers.getUserId(req);
    const { id, mcp_servers } = updateData;

    if (!id) {
      throw new BadRequestException('Agent ID is required');
    }

    if (!mcp_servers || typeof mcp_servers !== 'object') {
      throw new BadRequestException('MCP servers must be an object');
    }
    const agent = this.agentFactory.getAgentInstance(id, userId);
    if (!agent) {
      throw new BadRequestException('Agent not found or access denied');
    }
    // Update agent MCP configuration in database
    const q = new Postgres.Query(
      `UPDATE agents
       SET "mcp_servers" = $1::jsonb
       WHERE id = $2 AND user_id = $3
       RETURNING id, "mcp_servers"`,
      [mcp_servers, id, userId]
    );

    const result = await Postgres.query<UpdateAgentMcpDTO>(q);

    if (result.length === 0) {
      throw new BadRequestException('Agent not found');
    }
    const updatedAgent = result[0];

    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: updatedAgent.mcp_servers,
    });
  }

  @Post('update_agent_config')
  @HandleWithBadRequestPreservation('Update failed')
  async updateAgentConfig(
    @Body() config: AgentConfig.WithOptionalParam,
    @Req() req: FastifyRequest
  ): Promise<AgentResponse> {
    logger.info('update_agent_config called');
    const userId = ControllerHelpers.getUserId(req);

    if (!config || typeof config !== 'object') {
      throw new BadRequestException('Configuration object is required');
    }
    const id = config.id;
    if (!id) {
      throw new BadRequestException('Agent ID is required');
    }
    try {
      // Use the existing update_agent_complete function
      const query = `
  SELECT success, message, updated_agent_id
  FROM update_agent_complete($1::UUID, $2::UUID, $3::JSONB)
`;

      const result = await Postgres.query(
        new Postgres.Query(query, [
          id,
          userId,
          JSON.stringify(config), // Pass entire config as JSONB
        ])
      );

      const updateResult = result[0];
      if (!updateResult.success) {
        throw new BadRequestException(updateResult.message);
      }

      // Fetch updated agent
      const fetchQuery = new Postgres.Query(
        `SELECT
          id,
          row_to_json(profile) as profile,
          mcp_servers,
          prompts_id,
          row_to_json(graph) as graph,
          row_to_json(memory) as memory,
          row_to_json(rag) as rag,
          created_at,
          updated_at,
          avatar_image,
          avatar_mime_type
        FROM agents WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      const agent =
        await Postgres.query<AgentConfig.OutputWithoutUserId>(fetchQuery);

      return {
        status: 'success',
        data: agent[0],
      };
    } catch (error) {
      logger.error('Error in updateAgentConfig:', {
        agentId: id,
        error: error.message,
      });

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Update failed: ${error.message}`);
    }
  }

  @Post('upload-avatar')
  @HandleWithBadRequestPreservation('Upload failed')
  async uploadAvatar(
    @Req() req: FastifyRequest
  ) {
    logger.info('upload_avatar called');
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
    logger.info('request called');
    const userId = ControllerHelpers.getUserId(req);

    const route = this.reflector.get('path', this.handleUserRequest);
    let agent: SnakAgent | undefined = undefined;
    if (userRequest.request.agent_id === undefined) {
      logger.info(
        'Agent ID not provided in request, Using agent Selector to select agent'
      );

      if (
        !userRequest.request.content ||
        userRequest.request.content?.length === 0
      ) {
        throw new ServerError('E01TA400'); // Bad request if no content
      }
      const agentSelector = this.agentFactory.getAgentSelector();
      agent = await agentSelector.execute(userRequest.request.content);
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

    const messageRequest: MessageRequest = {
      agent_id: agent.getAgentConfig().id.toString(),
      request: userRequest.request.content ?? '',
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
    logger.info('stop_agent called');
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
    logger.info('init_agent called');
    const userId = ControllerHelpers.getUserId(req);

    const newAgentConfig = await this.agentFactory.addAgent(
      userRequest.agent,
      userId
    );

    metrics.agentConnect();

    return ResponseFormatter.success(
      `Agent ${newAgentConfig.profile.name} added and registered with supervisor`
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
    logger.info('get_messages_from_agent called');
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
    logger.info('delete_agent called');
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
    logger.info('delete_agents called');
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
    logger.info('get_messages_from_agents called');
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
    logger.info('clear_message called');
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
    logger.info('get_agents called');
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
    logger.info('get_agent_status called');
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
    logger.info('get_agent_thread called');
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
    logger.info('health called');
    const response: AgentResponse = {
      status: 'success',
      data: 'Agent is healthy',
    };
    return response;
  }

 

}
