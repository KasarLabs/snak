import { DynamicStructuredTool } from '@langchain/core/tools';
import { agents } from '@snakagent/database/queries';
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

        const searchBy = input.searchBy || 'name';
        const agent = await agents.getAgentProfile(
          input.identifier,
          userId,
          searchBy
        );

        if (!agent) {
          return JSON.stringify({
            success: false,
            message: `Agent not found with ${searchBy}: ${input.identifier}`,
          });
        }

        logger.debug(`Agent profile: ${agent.id}`);

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
        const deletedAgent = await agents.deleteAgent(agent.id, userId);
        if (!deletedAgent) {
          return JSON.stringify({
            success: false,
            message: `Failed to delete agent. It may have already been deleted or you don't have permission.`,
          });
        }
        logger.debug(`Agent ${deletedAgent.id} deleted from database`);

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
