import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

const RemoveMcpServerSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The agent ID or name to remove MCP server from (extract from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .nullable()
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
  serverName: z
    .string()
    .min(1)
    .describe('The name/identifier of the MCP server to remove'),
});

export function removeMcpServerTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'remove_mcp_server',
    description:
      'Remove/uninstall/delete a specific MCP server from an agent. Use when user wants to remove MCP server capabilities from an existing agent.',
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
        if (agent.profile.group === 'system') {
          return JSON.stringify({
            success: false,
            message:
              'Cannot remove MCP server from agent in "system" group - this agent is protected.',
          });
        }

        // Get current MCP servers configuration
        const currentMcpServers = agent.mcp_servers || {};

        // Check if server exists
        if (!currentMcpServers[input.serverName]) {
          return JSON.stringify({
            success: false,
            message: `MCP server "${input.serverName}" not found for this agent. Available servers: ${Object.keys(currentMcpServers).join(', ') || 'none'}`,
          });
        }

        // Remove the MCP server
        const updatedMcpServers = { ...currentMcpServers };
        delete updatedMcpServers[input.serverName];

        // Update the agent with updated MCP servers
        const updateQuery = new Postgres.Query(
          'UPDATE agents SET "mcp_servers" = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [updatedMcpServers, agent.id, userId]
        );

        const result = await Postgres.query<AgentConfig.Input>(updateQuery);

        if (result.length > 0) {
          logger.info(
            `Removed MCP server "${input.serverName}" from agent "${agent.profile.name}" successfully for user ${userId}`
          );

          return JSON.stringify({
            success: true,
            message: `MCP server "${input.serverName}" removed successfully from agent "${agent.profile.name}"`,
            data: {
              agentId: agent.id,
              agentName: agent.profile.name,
              removedServerName: input.serverName,
              remainingMcpServers: Object.keys(updatedMcpServers),
              totalMcpServers: Object.keys(updatedMcpServers).length,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to remove MCP server from agent',
          });
        }
      } catch (error) {
        logger.error(`Error removing MCP server: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to remove MCP server',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
