import { DynamicStructuredTool } from '@langchain/core/tools';

import { Postgres, redisAgents } from '@snakagent/database/queries';
import { logger, McpServerConfig } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { AddMcpServerSchema } from './schemas/mcp.schemas.js';
import { isProtectedAgent } from '../utils/agents.validators.js';
import { normalizeMcpServersConfig } from '../utils/normalizeAgentValues.js';

export function addMcpServerTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'add_mcp_server',
    description:
      'Add/install/configure one or multiple new MCP servers for a specific agent. Use when user wants to add MCP server capabilities to an existing agent.',
    schema: AddMcpServerSchema,
    func: async (input) => {
      try {
        logger.info(`Adding MCP server(s) to agent: ${input.identifier}`);
        const userId = agentConfig.user_id;

        // First, find the agent (we need id, profile, and mcp_servers)
        let findQuery: Postgres.Query;
        const searchBy = input.searchBy || 'name';

        if (searchBy === 'id') {
          findQuery = new Postgres.Query(
            `SELECT id, row_to_json(profile) as profile, mcp_servers
             FROM agents WHERE id = $1 AND user_id = $2`,
            [input.identifier, userId]
          );
        } else {
          findQuery = new Postgres.Query(
            `SELECT id, row_to_json(profile) as profile, mcp_servers
             FROM agents WHERE (profile).name = $1 AND user_id = $2`,
            [input.identifier, userId]
          );
        }

        const existingAgent = await Postgres.query<{
          id: string;
          profile: {
            name: string;
            group: string;
            description: string;
            contexts: string[];
          };
          mcp_servers: Record<string, McpServerConfig>;
        }>(findQuery);
        if (existingAgent.length === 0) {
          return JSON.stringify({
            success: false,
            message: `Agent not found with ${searchBy}: ${input.identifier}`,
          });
        }

        const agent = existingAgent[0];

        // Check if agent is protected (supervisor agent or system group)
        const protectionCheck = isProtectedAgent(
          agent.profile.name,
          agent.profile.group
        );
        if (!protectionCheck.isValid) {
          return JSON.stringify({
            success: false,
            message: protectionCheck.message,
          });
        }

        // Get current MCP servers configuration
        const currentMcpServers = agent.mcp_servers || {};

        // Track added and already existing servers
        const added: string[] = [];
        const alreadyExists: string[] = [];

        // Convert array to Record<string, McpServerConfig>
        const mcpServersRecord: Record<string, McpServerConfig> = {};
        for (const server of input.mcp_servers) {
          const { name, env, ...serverConfig } = server;

          // Convert env array to Record<string, string>
          let envRecord: Record<string, string> | undefined;
          if (env && Array.isArray(env)) {
            envRecord = {};
            for (const envEntry of env) {
              envRecord[envEntry.name] = envEntry.value;
            }
          }

          mcpServersRecord[name] = {
            ...serverConfig,
            ...(envRecord && { env: envRecord }),
          };
        }

        // Normalize the new MCP servers configuration
        const { config: normalizedNewServers, appliedDefaults } =
          normalizeMcpServersConfig(mcpServersRecord);

        // Add the new MCP servers
        const updatedMcpServers = { ...currentMcpServers };
        for (const [serverName, serverConfig] of Object.entries(
          normalizedNewServers
        )) {
          if (currentMcpServers[serverName]) {
            alreadyExists.push(serverName);
          } else {
            updatedMcpServers[serverName] = serverConfig;
            added.push(serverName);
          }
        }

        // If no servers were actually added
        if (added.length === 0) {
          return JSON.stringify({
            success: false,
            message: `No new MCP servers added. All servers already exist: ${alreadyExists.join(', ')}. Use update_mcp_server to modify them.`,
          });
        }

        // Update the agent with new MCP servers
        const updateQuery = new Postgres.Query(
          `WITH updated AS (
            UPDATE agents
            SET "mcp_servers" = $1
            WHERE id = $2 AND user_id = $3
            RETURNING *
          )
          SELECT
            id,
            user_id,
            row_to_json(profile)        AS profile,
            mcp_servers,
            prompts_id,
            row_to_json(graph)          AS graph,
            row_to_json(memory)         AS memory,
            row_to_json(rag)            AS rag,
            created_at,
            updated_at,
            avatar_image,
            avatar_mime_type
          FROM updated`,
          [updatedMcpServers, agent.id, userId]
        );

        const result =
          await Postgres.query<AgentConfig.OutputWithId>(updateQuery);

        if (result.length > 0) {
          logger.info(
            `Added MCP server(s) "${added.join(', ')}" to agent "${agent.profile.name}" successfully for user ${userId}`
          );

          // Update Redis cache
          try {
            await redisAgents.updateAgent(result[0]);
            logger.debug(`Agent ${result[0].id} updated in Redis`);
          } catch (error) {
            logger.error(`Failed to update agent in Redis: ${error}`);
            // Don't throw here, Redis is a cache, PostgreSQL is the source of truth
          }

          const message =
            added.length === 1
              ? `MCP server "${added[0]}" added successfully to agent "${agent.profile.name}"`
              : `${added.length} MCP servers added successfully to agent "${agent.profile.name}"`;

          const warningMessage =
            alreadyExists.length > 0
              ? ` Note: ${alreadyExists.length} server(s) already existed: ${alreadyExists.join(', ')}`
              : '';

          const normalizationMessage =
            appliedDefaults.length > 0
              ? ` Note: ${appliedDefaults.join('; ')}`
              : '';

          return JSON.stringify({
            success: true,
            message: message + warningMessage + normalizationMessage,
            data: {
              agentId: agent.id,
              agentName: agent.profile.name,
              addedServers: added,
              alreadyExistingServers: alreadyExists,
              totalMcpServers: Object.keys(updatedMcpServers).length,
              appliedDefaults: appliedDefaults,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to add MCP servers to agent',
          });
        }
      } catch (error) {
        logger.error(`Error adding MCP server(s): ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to add MCP server(s)',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
