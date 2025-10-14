import { DynamicStructuredTool } from '@langchain/core/tools';
import { agents } from '@snakagent/database/queries';
import { logger, AgentConfig } from '@snakagent/core';
import { ListAgentsSchema } from './schemas/listAgent.schema.js';

export function listAgentsTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'list_agents',
    description:
      'List/show/get all agent configurations with optional filtering. Use when user wants to see multiple agents, all agents, or find agents matching certain criteria.',
    schema: ListAgentsSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;

        const result = await agents.listAgents(
          userId,
          input.filters,
          input.limit !== null && input.limit !== undefined ? input.limit : undefined,
          input.offset !== null && input.offset !== undefined ? input.offset : undefined
        );

        return JSON.stringify({
          success: true,
          message: `Found ${result.length} agent(s)`,
          data: result,
          count: result.length,
        });
      } catch (error) {
        logger.error(`Error listing agents: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to list agents',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
