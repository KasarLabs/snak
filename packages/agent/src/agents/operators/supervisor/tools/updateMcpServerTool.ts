import { DynamicStructuredTool } from '@langchain/core/tools';
import { Postgres, redisAgents } from '@snakagent/database/queries';
import { logger, McpServerConfig } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { UpdateMcpServerSchema } from './schemas/mcp.schemas.js';
import { isProtectedAgent } from '../utils/agents.validators.js';
import { normalizeMcpServersConfig } from '../utils/normalizeAgentValues.js';

export function updateMcpServerTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'update_mcp_server',
    description:
      'Update/modify/change configuration of one or multiple existing MCP servers for a specific agent. Use when user wants to modify MCP server settings or configuration.',
    schema: UpdateMcpServerSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;

        // First, find the agent
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

        // Track updated and not found servers
        const updated: string[] = [];
        const notFound: string[] = [];
        const updateDetails: Record<string, { old: any; new: any }> = {};

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

        // Update the MCP servers
        const updatedMcpServers = { ...currentMcpServers };
        for (const [serverName, serverConfig] of Object.entries(
          mcpServersRecord
        )) {
          if (currentMcpServers[serverName]) {
            const oldConfig = currentMcpServers[serverName];
            // Merge the new configuration with the existing one for partial updates
            const updatedServerConfig = {
              ...(oldConfig || {}),
              ...(serverConfig || {}),
            };
            updatedMcpServers[serverName] = updatedServerConfig;
            updated.push(serverName);
            updateDetails[serverName] = {
              old: oldConfig,
              new: updatedServerConfig,
            };
          } else {
            notFound.push(serverName);
          }
        }

        // Normalize the complete updated MCP servers configuration
        const { config: normalizedUpdatedServers, appliedDefaults } =
          normalizeMcpServersConfig(updatedMcpServers);

        if (updated.length === 0) {
          return JSON.stringify({
            success: false,
            message: `No MCP servers found to update. Servers not found: ${notFound.join(', ')}. Available servers: ${Object.keys(currentMcpServers).join(', ') || 'none'}`,
          });
        }

        // Update the agent with updated MCP servers
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
          [normalizedUpdatedServers, agent.id, userId]
        );

        const result =
          await Postgres.query<AgentConfig.OutputWithId>(updateQuery);

        if (result.length > 0) {
          logger.info(
            `Updated MCP server(s) "${updated.join(', ')}" for agent "${agent.profile.name}" successfully for user ${userId}`
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
            updated.length === 1
              ? `MCP server "${updated[0]}" updated successfully for agent "${agent.profile.name}"`
              : `${updated.length} MCP servers updated successfully for agent "${agent.profile.name}"`;

          const warningMessage =
            notFound.length > 0
              ? ` Note: ${notFound.length} server(s) not found: ${notFound.join(', ')}`
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
              updatedServers: updated,
              notFoundServers: notFound,
              updateDetails: updateDetails,
              totalMcpServers: Object.keys(normalizedUpdatedServers).length,
              appliedDefaults: appliedDefaults,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to update MCP servers for agent',
          });
        }
      } catch (error) {
        logger.error(`Error updating MCP server(s): ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to update MCP server(s)',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
