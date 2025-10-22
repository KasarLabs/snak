import { DynamicStructuredTool } from '@langchain/core/tools';
import { redisAgents, agents } from '@snakagent/database/queries';
import { logger, AgentProfile, GraphConfig } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { normalizeNumericValues } from '../utils/normalizeAgentValues.js';
import { UpdateAgentSchema } from './schemas/index.js';
import {
  isProtectedAgent,
  validateAgentProperties,
} from '../utils/agents.validators.js';

/**
 * Helper function to deep merge two objects, filtering out null/undefined values
 */
function deepMerge<T extends Record<string, any>>(
  existing: T,
  updates: Partial<T>
): T {
  const result = { ...existing };

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    // If both are objects (and not arrays), recursively merge
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof result[key as keyof T] === 'object' &&
      !Array.isArray(result[key as keyof T]) &&
      result[key as keyof T] !== null
    ) {
      result[key as keyof T] = deepMerge(
        result[key as keyof T] as any,
        value
      ) as any;
    } else {
      result[key as keyof T] = value;
    }
  });

  return result;
}

export function updateAgentTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'update_agent',
    description:
      'Update/modify/change/rename specific properties of an existing agent configuration. Use when user wants to modify, change, update, edit, or rename any agent property like name, description, group, etc.',
    schema: UpdateAgentSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;

        // First, find the agent (we need all fields for deep merge)
        const searchBy = input.searchBy || 'name';
        const agent = await agents.getAgentComplete(
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

        // Check if agent is protected (supervisor agent or system group)
        const protectionCheck = isProtectedAgent(
          agent.agentConfig.profile.name,
          agent.agentConfig.profile.group
        );
        if (!protectionCheck.isValid) {
          return JSON.stringify({
            success: false,
            message: protectionCheck.message,
          });
        }

        const updates = input.updates;

        // Validate updates before processing
        if (updates.profile?.name || updates.profile?.group) {
          const validation = validateAgentProperties(
            updates.profile?.name,
            updates.profile?.group
          );
          if (!validation.isValid) {
            return JSON.stringify({
              success: false,
              message: validation.message,
            });
          }
        }

        // Start with the complete existing agent configuration
        const mergedConfig: AgentConfig.Input = { ...agent.agentConfig };

        // Apply updates to the merged configuration with deep merge for composite types
        Object.entries(updates).forEach(([key, value]) => {
          // Skip the entire field if it's null or undefined
          if (value === undefined || value === null) {
            return;
          }

          // Deep merge for profile (composite type with name, group, description, contexts)
          if (
            key === 'profile' &&
            typeof value === 'object' &&
            value !== null
          ) {
            mergedConfig.profile = deepMerge(
              agent.agentConfig.profile,
              value as Partial<AgentProfile>
            );
          }
          // Deep merge for memory (composite type with nested size_limits, thresholds, timeouts)
          else if (
            key === 'memory' &&
            typeof value === 'object' &&
            value !== null
          ) {
            mergedConfig.memory = deepMerge(
              agent.agentConfig.memory,
              value as Partial<AgentConfig.Input['memory']>
            );
          }
          // Deep merge for rag (composite type with enabled, top_k)
          else if (
            key === 'rag' &&
            typeof value === 'object' &&
            value !== null
          ) {
            mergedConfig.rag = deepMerge(
              agent.agentConfig.rag,
              value as Partial<AgentConfig.Input['rag']>
            );
          }
          // Deep merge for graph (composite type with nested model)
          else if (
            key === 'graph' &&
            typeof value === 'object' &&
            value !== null
          ) {
            mergedConfig.graph = deepMerge(
              agent.agentConfig.graph,
              value as Partial<GraphConfig>
            );
          }
          // For other fields, simple assignment
          else {
            (mergedConfig as any)[key] = value;
          }
        });

        // Normalize the complete merged configuration
        const { normalizedConfig: normalizedMergedConfig, appliedDefaults } =
          normalizeNumericValues(mergedConfig);

        // Use the updateAgentComplete function instead of direct SQL
        const result = await agents.updateAgentComplete(agent.id, userId, {
          ...normalizedMergedConfig,
          id: agent.id,
        });

        if (result.success) {
          logger.info(
            `Updated agent "${result.agent_data.profile.name}" successfully`
          );

          // Update Redis cache
          try {
            await redisAgents.updateAgent(result.agent_data);
            logger.debug(`Agent ${result.updated_agent_id} updated in Redis`);
          } catch (error) {
            logger.error(`Failed to update agent in Redis: ${error}`);
            // Don't throw here, Redis is a cache, PostgreSQL is the source of truth
          }

          let message = result.message;
          if (appliedDefaults.length > 0) {
            message += `. Note: ${appliedDefaults.join('; ')}`;
          }

          const { user_id: _, ...agent }: AgentConfig.OutputWithoutUserId =
            result.agent_data;

          return JSON.stringify({
            success: true,
            message: message,
            data: agent,
          });
        } else {
          return JSON.stringify({
            success: false,
            message: result.message,
          });
        }
      } catch (error) {
        logger.error(`Error updating agent: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to update agent configuration',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
