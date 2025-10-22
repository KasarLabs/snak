import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { agents } from '@snakagent/database/queries';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { SelectAgentSchema } from './schemas/common.schemas.js';

const ReadAgentSchema = SelectAgentSchema;

export function readAgentTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'read_agent',
    description:
      'Get/retrieve/show/view/find details and configuration of a specific agent by ID or name. Use when user wants to see information about a particular agent.',
    schema: ReadAgentSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;
        const searchBy = input.searchBy === 'id' ? 'id' : 'name';

        const agent = await agents.readAgent(
          input.identifier,
          userId,
          searchBy
        );

        if (agent) {
          return JSON.stringify({
            success: true,
            message: 'Agent configuration retrieved successfully',
            data: agent,
          });
        } else {
          return JSON.stringify({
            success: false,
            message: `Agent not found with ${searchBy}: ${input.identifier}`,
          });
        }
      } catch (error) {
        logger.error(`Error reading agent: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to read agent configuration',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
