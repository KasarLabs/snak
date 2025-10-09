import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

const McpServerConfigSchema = z.object({
  command: z.string().min(1).describe('The command to execute the MCP server'),
  args: z
    .array(z.string())
    .optional()
    .describe('Optional arguments for the command'),
  env: z
    .record(z.string())
    .optional()
    .describe('Optional environment variables'),
});

const AddMcpServerSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The agent ID or name to add MCP server to (extract from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
  serverName: z
    .string()
    .min(1)
    .describe('The name/identifier for the MCP server to add'),
  serverConfig: McpServerConfigSchema.describe(
    'The MCP server configuration object'
  ),
});

export function addMcpServerTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'add_mcp_server',
    description:
      'Add/install/configure a new MCP server for a specific agent. Use when user wants to add MCP server capabilities to an existing agent.',
    schema: AddMcpServerSchema,
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
              'Cannot add MCP server to agent from "system" group - this agent is protected.',
          });
        }

        // Get current MCP servers configuration
        const currentMcpServers = agent.mcp_servers || {};

        // Check if server name already exists
        if (currentMcpServers[input.serverName]) {
          return JSON.stringify({
            success: false,
            message: `MCP server "${input.serverName}" already exists for this agent. Use update_mcp_server to modify it.`,
          });
        }

        // Add the new MCP server
        const updatedMcpServers = {
          ...currentMcpServers,
          [input.serverName]: input.serverConfig,
        };

        // Update the agent with new MCP servers
        const updateQuery = new Postgres.Query(
          'UPDATE agents SET "mcp_servers" = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
          [updatedMcpServers, agent.id, userId]
        );

        const result =
          await Postgres.query<AgentConfig.OutputWithId>(updateQuery);

        if (result.length > 0) {
          logger.info(
            `Added MCP server "${input.serverName}" to agent "${agent.profile.name}" successfully for user ${userId}`
          );

          return JSON.stringify({
            success: true,
            message: `MCP server "${input.serverName}" added successfully to agent "${agent.profile.name}"`,
            data: {
              agentId: agent.id,
              agentName: agent.profile.name,
              serverName: input.serverName,
              serverConfig: input.serverConfig,
              totalMcpServers: Object.keys(updatedMcpServers).length,
            },
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to add MCP server to agent',
          });
        }
      } catch (error) {
        logger.error(`Error adding MCP server: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to add MCP server',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
