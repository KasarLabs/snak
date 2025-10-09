import { DynamicStructuredTool } from '@langchain/core/tools';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { RemoveMcpServerSchema } from './schemas/mcp.schemas.js';
import { isProtectedAgent } from '../utils/agents.validators.js';

export function removeMcpServerTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'remove_mcp_server',
    description:
      'Remove/uninstall/delete one or multiple MCP servers from an agent. Use when user wants to remove MCP server capabilities from an existing agent.',
    schema: RemoveMcpServerSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;

        // First, find the agent
        let findQuery: Postgres.Query;
        const searchBy = input.searchBy || 'name';

        if (searchBy === 'id') {
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
            [input.identifier, userId]
          );
        } else {
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE (profile).name = $1 AND user_id = $2',
            [input.identifier, userId]
          );
        }

        const existingAgent =
          await Postgres.query<AgentConfig.OutputWithId>(findQuery);
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

        // Track removed and not found servers
        const removed: string[] = [];
        const notFound: string[] = [];

        // Remove the MCP servers
        const updatedMcpServers = { ...currentMcpServers };
        for (const serverName of input.serverNames) {
          if (currentMcpServers[serverName]) {
            delete updatedMcpServers[serverName];
            removed.push(serverName);
          } else {
            notFound.push(serverName);
          }
        }

        // If no servers were actually removed
        if (removed.length === 0) {
          return JSON.stringify({
            success: false,
            message: `No MCP servers found to remove. Servers not found: ${notFound.join(', ')}. Available servers: ${Object.keys(currentMcpServers).join(', ') || 'none'}`,
          });
        }

        // Update the agent with updated MCP servers
        const updateQuery = new Postgres.Query(
          'UPDATE agents SET "mcp_servers" = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [updatedMcpServers, agent.id, userId]
        );

        const result = await Postgres.query<AgentConfig.Input>(updateQuery);

        if (result.length > 0) {
          logger.info(
            `Removed MCP server(s) "${removed.join(', ')}" from agent "${agent.profile.name}" successfully for user ${userId}`
          );

          const message =
            removed.length === 1
              ? `MCP server "${removed[0]}" removed successfully from agent "${agent.profile.name}"`
              : `${removed.length} MCP servers removed successfully from agent "${agent.profile.name}"`;

          const warningMessage =
            notFound.length > 0
              ? ` Note: ${notFound.length} server(s) not found: ${notFound.join(', ')}`
              : '';

          return JSON.stringify({
            success: true,
            message: message + warningMessage,
            data: {
              agentId: agent.id,
              agentName: agent.profile.name,
              removedServers: removed,
              notFoundServers: notFound,
              remainingMcpServers: Object.keys(updatedMcpServers),
              totalMcpServers: Object.keys(updatedMcpServers).length,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to remove MCP servers from agent',
          });
        }
      } catch (error) {
        logger.error(`Error removing MCP server(s): ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to remove MCP server(s)',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
