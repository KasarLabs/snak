import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

const DeleteAgentSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The agent ID or name to delete (extract exact name from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .nullable()
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
  confirm: z
    .boolean()
    .optional()
    .nullable()
    .describe(
      'Confirmation to proceed with deletion (automatically set to true when user clearly intends to delete)'
    ),
});

export const deleteAgentTool = new DynamicStructuredTool({
  name: 'delete_agent',
  description:
    'Delete/remove/destroy an agent configuration permanently. Use when user wants to delete, remove, or destroy an agent completely.',
  schema: DeleteAgentSchema,
  func: async (input) => {
    try {
      const confirm = input.confirm ?? true;
      if (!confirm) {
        return JSON.stringify({
          success: false,
          message:
            'Deletion requires explicit confirmation. Set confirm to true.',
        });
      }

      // First, find the agent
      let findQuery: Postgres.Query;
      const searchBy = input.searchBy || 'name';
      if (searchBy === 'id') {
        // PostgresQuery relation : agents
        findQuery = new Postgres.Query('SELECT * FROM agents WHERE id = $1', [
          input.identifier,
        ]);
      } else {
        // PostgresQuery relation : agents
        findQuery = new Postgres.Query('SELECT * FROM agents WHERE name = $1', [
          input.identifier,
        ]);
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

      // Delete the agent
      const deleteQuery = new Postgres.Query(
        'DELETE FROM agents WHERE id = $1',
        [agent.id]
      );
      await Postgres.query(deleteQuery);

      logger.info(`Deleted agent "${agent.name}" successfully`);
      return JSON.stringify({
        success: true,
        message: `Agent "${agent.name}" deleted successfully`,
      });
    } catch (error) {
      logger.error(`Error deleting agent: ${error}`);
      return JSON.stringify({
        success: false,
        message: 'Failed to delete agent',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
