import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

const ReadAgentSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The agent ID or name to retrieve (extract exact name from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .nullable()
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
});

export const readAgentTool = new DynamicStructuredTool({
  name: 'read_agent',
  description:
    'Get/retrieve/show/view/find details and configuration of a specific agent by ID or name. Use when user wants to see information about a particular agent.',
  schema: ReadAgentSchema,
  func: async (input) => {
    try {
      let query: Postgres.Query;
      const searchBy = input.searchBy === 'id' ? 'id' : 'name';

      if (searchBy === 'id') {
        query = new Postgres.Query('SELECT * FROM agents WHERE id = $1', [
          input.identifier,
        ]);
      } else {
        query = new Postgres.Query('SELECT * FROM agents WHERE name = $1', [
          input.identifier,
        ]);
      }

      const result = await Postgres.query<AgentConfig>(query);

      if (result.length > 0) {
        return JSON.stringify({
          success: true,
          message: 'Agent configuration retrieved successfully',
          data: result[0],
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
