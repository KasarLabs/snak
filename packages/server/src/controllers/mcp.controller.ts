import {
  BadRequestException,
  UnprocessableEntityException,
  Controller,
  Get,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { Postgres } from '@snakagent/database';

import { AgentService } from '../services/agent.service.js';
import { AgentStorage } from '../agents.storage.js';
import {
  ResponseFormatter,
  HandleWithBadRequestPreservation,
  HandleErrors,
} from '../utils/error-handler.js';
import { ControllerHelpers } from '../utils/controller-helpers.js';
import {
  extractFlagValue,
  updateFlagValue,
  normalizeRawMcpConfig,
  fetchSmitheryManifest,
  formatMcpServersForResponse,
} from '../utils/mcp-helpers.js';

import {
  GetAgentMcpsRequestDTO,
  AgentMCPRequestDTO,
  UpdateMcpEnvValueRequestDTO,
  DeleteMultipleMcpServersRequestDTO,
  UpdateMcpValueRequestDTO,
  logger,
} from '@snakagent/core';

interface UpdateAgentMcpDTO {
  id: string;
  mcp_servers: Record<string, any>;
}

/**
 * All MCP-related endpoints, namespaced under /agents/mcp
 */
@Controller('agents/mcp')
export class McpController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentFactory: AgentStorage
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
      agents.map((agent: { id: any; mcp_servers: Record<string, any> }) => ({
        agent_id: agent.id,
        mcp_servers: formatMcpServersForResponse(agent.mcp_servers),
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
      mcp_servers: formatMcpServersForResponse(agent.mcp_servers),
    });
  }

  /**
   * Add a new MCP server from Smithery manifest.
   * @param { agent_id, mcp_id }
   * @returns Updated MCP servers config
   */
  @Post('add_mcp_server_smithery')
  @HandleWithBadRequestPreservation('Smithery MCP server addition failed')
  async addMcpServerSmithery(
    @Body() body: AgentMCPRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId } = body;

    if (!agentId || !mcpId)
      throw new BadRequestException('agent_id and mcp_id are required');

    const manifest = await fetchSmitheryManifest(mcpId);
    if (!manifest)
      throw new BadRequestException(
        `Failed to fetch manifest for MCP ${mcpId}`
      );

    const env: Record<string, string> = {
      SMITHERY_API_KEY: '',
      SMITHERY_PROFILE_NAME: '',
    };

    if (manifest.env && typeof manifest.env === 'object') {
      for (const [k, _v] of Object.entries(manifest.env)) {
        if (!(k in env)) env[k] = '';
      }
    }

    const args: string[] = [
      '-y',
      '@smithery/cli@latest',
      'run',
      mcpId,
      '--key',
      '',
      '--profile',
      '',
    ];

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const current = agents[0].mcp_servers ?? {};
    const sanitizedCfg = {
      command: 'npx',
      args,
      env,
    };

    const updated = { ...current, [mcpId]: sanitizedCfg };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updated, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);

    const [updatedAgent] = result;
    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: formatMcpServersForResponse(updatedAgent.mcp_servers),
    });
  }

  /**
   * Add raw MCP server config to an agent.
   * @param { agent_id, mcpServers }
   * @returns Updated MCP servers config
   */
  @Post('add_mcp_server_raw')
  @HandleWithBadRequestPreservation('Raw MCP server addition failed')
  async addMcpServerRaw(
    @Body() body: { agent_id: string; mcpServers: Record<string, any> },
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcpServers } = body;

    if (!agentId) throw new BadRequestException('agent_id is required');
    if (
      !mcpServers ||
      typeof mcpServers !== 'object' ||
      Object.keys(mcpServers).length === 0
    ) {
      throw new BadRequestException('mcpServers must be a non-empty object');
    }

    const normalized: Record<string, any> = {};
    for (const [id, cfg] of Object.entries(mcpServers)) {
      const cleanCfg = normalizeRawMcpConfig(cfg);
      delete cleanCfg.env;
      normalized[id] = cleanCfg;
    }

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const current = agents[0].mcp_servers ?? {};
    const updated = { ...current, ...normalized };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updated, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    if (result.length === 0)
      throw new BadRequestException('Failed to update MCP servers');


    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: formatMcpServersForResponse(result[0].mcp_servers),
    });
  }

  /**
   * Delete one MCP server configuration from an agent.
   * @param { agent_id, mcp_id }
   * @returns Updated mcp_servers config
   */
  @Post('delete_mcp_server')
  @HandleWithBadRequestPreservation('MCP server delete failed')
  async deleteMcpServer(
    @Body() body: AgentMCPRequestDTO,
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

    const [updatedAgent] = result;
    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: formatMcpServersForResponse(updatedAgent.mcp_servers),
    });
  }

  /**
   * Delete multiple MCP servers from an agent.
   * @param { agent_id, mcp_ids[] }
   * @returns Updated mcp_servers config
   */
  @Post('delete_multiple_mcp_server')
  @HandleWithBadRequestPreservation('MCP servers delete failed')
  async deleteMcpServers(
    @Body() body: DeleteMultipleMcpServersRequestDTO,
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

    const [updatedAgent] = result;
    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: formatMcpServersForResponse(updatedAgent.mcp_servers),
    });
  }

  /**
   * Delete all MCP servers for an agent.
   * @param { agent_id }
   * @returns { mcp_servers = {} }
   */
  @Post('delete_all_mcp_servers')
  @HandleWithBadRequestPreservation('Delete all MCP servers failed')
  async deleteAllMcpServers(
    @Body() body: GetAgentMcpsRequestDTO,
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


    const [updatedAgent] = result;
    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: formatMcpServersForResponse(updatedAgent.mcp_servers),
    });
  }

  /**
   * Add or update a single environment variable for a given MCP server.
   * @param { agent_id, mcp_id, secret_name, secret_value }
   * @returns Updated MCP servers config
   */
  @Post('add_mcp_env')
  @HandleWithBadRequestPreservation('Failed to add or update MCP env variable')
  async addMcpEnv(
    @Body() body: UpdateMcpEnvValueRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const {
      agent_id: agentId,
      mcp_id: mcpId,
      secret_name,
      secret_value,
    } = body;

    if (!agentId || !mcpId || !secret_name) {
      throw new BadRequestException(
        'agent_id, mcp_id and secret_name are required'
      );
    }

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];
    if (!currentConfig) {
      throw new BadRequestException(`MCP server "${mcpId}" not found`);
    }

    const currentEnv =
      currentConfig.env && typeof currentConfig.env === 'object'
        ? { ...currentConfig.env }
        : {};

    currentEnv[secret_name] = secret_value;

    const updatedServers = {
      ...currentServers,
      [mcpId]: {
        ...currentConfig,
        env: currentEnv,
      },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    if (result.length === 0)
      throw new BadRequestException('Failed to add env variable');


    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: formatMcpServersForResponse(result[0].mcp_servers),
    });
  }

  /**
   * Get all environment variables for a specific MCP server.
   * @param { agent_id, mcp_id }
   * @returns { env }
   */
  @Post('get_mcp_env')
  @HandleWithBadRequestPreservation('Failed to fetch MCP env')
  async getMcpEnv(
    @Body() body: AgentMCPRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId } = body;

    if (!agentId || !mcpId) {
      throw new BadRequestException('agent_id and mcp_id are required');
    }

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const mcpServers = agents[0].mcp_servers ?? {};
    const mcpConfig = mcpServers[mcpId];

    if (!mcpConfig) {
      throw new BadRequestException(`MCP server "${mcpId}" not found`);
    }

    const env =
      mcpConfig.env && typeof mcpConfig.env === 'object' ? mcpConfig.env : {};

    return ResponseFormatter.success({
      agent_id: agentId,
      mcp_id: mcpId,
      env,
    });
  }

  /**
   * Get the value of `--key` flag for a given MCP server.
   * @param { agent_id, mcp_id }
   * @returns { key }
   */
  @Post('get_mcp_key')
  @HandleErrors('E03MCP101')
  async getMcpKey(
    @Body() body: AgentMCPRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId } = body;

    const q = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(q);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const mcp_servers = agents[0].mcp_servers ?? {};
    const mcpConfig = mcp_servers[mcpId];
    if (!mcpConfig || !Array.isArray(mcpConfig.args)) {
      throw new BadRequestException('MCP server not found or invalid');
    }

    const keyValue = extractFlagValue(mcpConfig.args, '--key');
    if (!keyValue) throw new BadRequestException('No key found for this MCP');

    return ResponseFormatter.success({ key: keyValue });
  }

  /**
   * Get the value of `--profile` flag for a given MCP server.
   * @param { agent_id, mcp_id }
   * @returns { profile }
   */
  @Post('get_mcp_profile')
  @HandleErrors('E03MCP102')
  async getMcpProfile(
    @Body() body: AgentMCPRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId } = body;

    const q = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(q);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const mcp_servers = agents[0].mcp_servers ?? {};
    const mcpConfig = mcp_servers[mcpId];
    if (!mcpConfig || !Array.isArray(mcpConfig.args)) {
      throw new BadRequestException('MCP server not found or invalid');
    }

    const profileValue = extractFlagValue(mcpConfig.args, '--profile');
    if (!profileValue)
      throw new BadRequestException('No profile found for this MCP');

    return ResponseFormatter.success({ profile: profileValue });
  }

  /**
   * Update the `--key` flag for a given MCP server.
   * @param { agent_id, mcp_id, new_value }
   * @returns Updated MCP servers config
   */
  @Post('update_mcp_key')
  @HandleWithBadRequestPreservation('MCP key update failed')
  async updateMcpKey(
    @Body() body: UpdateMcpValueRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, new_value: newKey } = body;

    if (!agentId || !mcpId || !newKey) {
      throw new BadRequestException(
        'agent_id, mcp_id and new_value are required'
      );
    }

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];
    if (!currentConfig || !Array.isArray(currentConfig.args)) {
      throw new BadRequestException('MCP not found or invalid configuration');
    }

    const updatedArgs = updateFlagValue(currentConfig.args, '--key', newKey);

    const updatedServers = {
      ...currentServers,
      [mcpId]: { ...currentConfig, args: updatedArgs },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);
    if (result.length === 0)
      throw new BadRequestException('Failed to update MCP key');


    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: formatMcpServersForResponse(result[0].mcp_servers),
    });
  }

  /**
   * Update the `--profile` flag for a given MCP server.
   * @param { agent_id, mcp_id, new_value }
   * @returns Updated MCP servers config
   */
  @Post('update_mcp_profile')
  @HandleWithBadRequestPreservation('MCP profile update failed')
  async updateMcpProfile(
    @Body() body: UpdateMcpValueRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, new_value: newProfile } = body;

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];
    if (!currentConfig) throw new BadRequestException('MCP server not found');

    const updatedArgs = updateFlagValue(
      currentConfig.args,
      '--profile',
      newProfile
    );

    const updatedServers = {
      ...currentServers,
      [mcpId]: {
        ...currentConfig,
        args: updatedArgs,
      },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);


    const [updatedAgent] = result;
    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: formatMcpServersForResponse(updatedAgent.mcp_servers),
    });
  }

  /**
   * Update a specific environment variable value for a given MCP server.
   * @param { agent_id, mcp_id, secret_name, secret_value }
   * @returns Updated MCP servers config
   */
  @Post('update_mcp_env_value')
  @HandleWithBadRequestPreservation('MCP env value update failed')
  async updateMcpEnvValue(
    @Body() body: UpdateMcpEnvValueRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const {
      agent_id: agentId,
      mcp_id: mcpId,
      secret_name,
      secret_value,
    } = body;

    if (!agentId || !mcpId || !secret_name)
      throw new BadRequestException(
        'agent_id, mcp_id and secret_name are required'
      );

    const selectQuery = new Postgres.Query(
      'SELECT id, "mcp_servers" FROM agents WHERE id = $1 AND user_id = $2',
      [agentId, userId]
    );
    const agents = await Postgres.query<UpdateAgentMcpDTO>(selectQuery);
    if (agents.length === 0) throw new BadRequestException('Agent not found');

    const currentServers = agents[0].mcp_servers ?? {};
    const currentConfig = currentServers[mcpId];
    if (!currentConfig || typeof currentConfig !== 'object')
      throw new BadRequestException('MCP server not found');

    const env = { ...(currentConfig.env ?? {}) };

    // ✅ 1. Only update if the key exists
    if (!(secret_name in env)) {
      throw new BadRequestException(
        `Environment variable "${secret_name}" does not exist in MCP ${mcpId}`
      );
    }

    env[secret_name] = secret_value;

    // ✅ 2. Sync args dynamically
    let updatedArgs = [...(currentConfig.args ?? [])];

    // Update --key if API key changed
    if (secret_name.toLowerCase().includes('api_key')) {
      updatedArgs = updateFlagValue(updatedArgs, '--key', secret_value);
    }

    // Update --profile if SMITHERY_PROFILE_NAME changed
    if (secret_name === 'SMITHERY_PROFILE_NAME') {
      updatedArgs = updateFlagValue(updatedArgs, '--profile', secret_value);
    }

    const updatedServers = {
      ...currentServers,
      [mcpId]: {
        ...currentConfig,
        env,
        args: updatedArgs,
      },
    };

    const updateQuery = new Postgres.Query(
      'UPDATE agents SET "mcp_servers" = $1::jsonb WHERE id = $2 AND user_id = $3 RETURNING id, "mcp_servers"',
      [updatedServers, agentId, userId]
    );
    const result = await Postgres.query<UpdateAgentMcpDTO>(updateQuery);


    return ResponseFormatter.success({
      agent_id: result[0].id,
      mcp_servers: formatMcpServersForResponse(result[0].mcp_servers),
    });
  }

  /**
   * Delete a secret from one MCP server of a given agent.
   * @param { agent_id, mcp_id, new_value }
   * @returns Updated mcp_servers config
   */
  @Post('delete_mcp_env')
  @HandleWithBadRequestPreservation('MCP env delete failed')
  async deleteMcpEnv(
    @Body() body: UpdateMcpValueRequestDTO,
    @Req() req: FastifyRequest
  ) {
    const userId = ControllerHelpers.getUserId(req);
    const { agent_id: agentId, mcp_id: mcpId, new_value } = body;

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
    if (!(new_value in env)) {
      throw new BadRequestException(`Secret key "${new_value}" not found`);
    }
    delete env[new_value];

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


    const [updatedAgent] = result;
    return ResponseFormatter.success({
      id: updatedAgent.id,
      mcp_servers: formatMcpServersForResponse(updatedAgent.mcp_servers),
    });
  }
}
