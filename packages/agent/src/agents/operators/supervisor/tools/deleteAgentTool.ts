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
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
  confirm: z
    .boolean()
    .optional()
    .describe(
      'Confirmation to proceed with deletion (automatically set to true when user clearly intends to delete)'
    ),
});

export function deleteAgentTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'delete_agent',
    description:
      'Delete/remove/destroy an agent configuration permanently. Use when user wants to delete, remove, or destroy an agent completely.',
    schema: DeleteAgentSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;
        const confirm = input.confirm ?? false;
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
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
            [input.identifier, userId]
          );
        } else {
          // PostgresQuery relation : agents
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE (profile).name = $1 AND user_id = $2',
            [input.identifier, userId]
          );
        }

        const existingAgent =
          await Postgres.query<AgentConfig.OutputWithId>(findQuery);
        logger.debug(`Existing agent: ${JSON.stringify(existingAgent)}`);
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
              'Cannot delete agent from "system" group - this agent is protected.',
          });
        }

        // Delete the agent
        const deleteQuery = new Postgres.Query(
          'DELETE FROM agents WHERE id = $1 AND user_id = $2',
          [agent.id, userId]
        );
        await Postgres.query(deleteQuery);

        logger.info(
          `Deleted agent "${agent.profile.name}" successfully for user ${userId}`
        );
        return JSON.stringify({
          success: true,
          message: `Agent "${agent.profile.name}" deleted successfully`,
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
}
