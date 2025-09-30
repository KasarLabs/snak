import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

const McpServerConfigSchema = z.object({
  command: z
    .string()
    .min(1)
    .optional()
    .nullable()
    .describe(
      'The command to execute the MCP server (optional for partial updates)'
    ),
  args: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Optional arguments for the command'),
  env: z
    .record(z.string())
    .optional()
    .nullable()
    .describe('Optional environment variables'),
});

const UpdateMcpServerSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The agent ID or name to update MCP server for (extract from user request, usually in quotes like "Ethereum RPC Agent")'
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
    .describe('The name/identifier of the MCP server to update'),
  serverConfig: McpServerConfigSchema.describe(
    'The updated MCP server configuration object'
  ),
});

export function updateMcpServerTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'update_mcp_server',
    description:
      'Update/modify/change configuration of an existing MCP server for a specific agent. Use when user wants to modify MCP server settings or configuration.',
    schema: UpdateMcpServerSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;

        // First, find the agent
        let findQuery: Postgres.Query;
        const searchBy = input.searchBy || 'name';

        if (searchBy === 'id') {
          const id = parseInt(input.identifier);
          if (isNaN(id)) {
            return JSON.stringify({
              success: false,
              message: `Invalid ID format: ${input.identifier}`,
            });
          }
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
            [id, userId]
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
              'Cannot update MCP server for agent in "system" group - this agent is protected.',
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

        // Get the old configuration for logging
        const oldConfig = currentMcpServers[input.serverName];

        // Merge the new configuration with the existing one for partial updates
        const updatedServerConfig = {
          ...oldConfig,
          ...input.serverConfig,
        };

        // Update the MCP server configuration
        const updatedMcpServers = {
          ...currentMcpServers,
          [input.serverName]: updatedServerConfig,
        };

        // Update the agent with updated MCP servers
        const updateQuery = new Postgres.Query(
          'UPDATE agents SET "mcp_servers" = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [updatedMcpServers, agent.id, userId]
        );

        const result = await Postgres.query<AgentConfig.Input>(updateQuery);

        if (result.length > 0) {
          logger.info(
            `Updated MCP server "${input.serverName}" for agent "${agent.profile.name}" successfully for user ${userId}`
          );

          return JSON.stringify({
            success: true,
            message: `MCP server "${input.serverName}" updated successfully for agent "${agent.profile.name}"`,
            data: {
              agentId: agent.id,
              agentName: agent.profile.name,
              serverName: input.serverName,
              oldConfig: oldConfig,
              updatedConfig: updatedServerConfig,
              totalMcpServers: Object.keys(updatedMcpServers).length,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to update MCP server for agent',
          });
        }
      } catch (error) {
        logger.error(`Error updating MCP server: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to update MCP server',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
