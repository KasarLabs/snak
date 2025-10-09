import { DynamicStructuredTool } from '@langchain/core/tools';
import { Postgres, redisAgents } from '@snakagent/database/queries';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { DeleteAgentSchema } from './schemas/deleteAgent.schema.js';
import { isProtectedAgent } from '../utils/agents.validators.js';

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

        // Delete the agent
        const deleteQuery = new Postgres.Query(
          'DELETE FROM agents WHERE id = $1 AND user_id = $2',
          [agent.id, userId]
        );
        await Postgres.query(deleteQuery);

        // Delete from Redis cache
        try {
          await redisAgents.deleteAgent(agent.id, userId);
          logger.debug(`Agent ${agent.id} deleted from Redis`);
        } catch (error) {
          logger.error(`Failed to delete agent from Redis: ${error}`);
          // Don't throw, PostgreSQL deletion is what matters
        }

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
