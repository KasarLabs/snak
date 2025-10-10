import { DynamicStructuredTool } from '@langchain/core/tools';
import { Postgres, redisAgents } from '@snakagent/database/queries';
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
        let findQuery: Postgres.Query;
        const searchBy = input.searchBy || 'name';

        if (searchBy === 'id') {
          findQuery = new Postgres.Query(
            `SELECT id, user_id, row_to_json(profile) as profile, mcp_servers, prompts_id,
             row_to_json(graph) as graph, row_to_json(memory) as memory, row_to_json(rag) as rag,
             created_at, updated_at, avatar_image, avatar_mime_type
             FROM agents WHERE id = $1 AND user_id = $2`,
            [input.identifier, userId]
          );
        } else {
          findQuery = new Postgres.Query(
            `SELECT id, user_id, row_to_json(profile) as profile, mcp_servers, prompts_id,
             row_to_json(graph) as graph, row_to_json(memory) as memory, row_to_json(rag) as rag,
             created_at, updated_at, avatar_image, avatar_mime_type
             FROM agents WHERE (profile).name = $1 AND user_id = $2`,
            [input.identifier, userId]
          );
        }

        const existingAgent =
          await Postgres.query<AgentConfig.Input>(findQuery);
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
        const mergedConfig: AgentConfig.Input = { ...agent };

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
              agent.profile,
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
              agent.memory,
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
              agent.rag,
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
              agent.graph,
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

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        // Use the complete normalized configuration for all fields that were updated
        Object.keys(updates).forEach((key) => {
          // Skip fields that were null or undefined in the updates
          if (
            updates[key as keyof typeof updates] === undefined ||
            updates[key as keyof typeof updates] === null
          ) {
            return;
          }

          const value =
            normalizedMergedConfig[key as keyof typeof normalizedMergedConfig];

          // Handle profile composite type (name, group, description, contexts)
          if (
            key === 'profile' &&
            typeof value === 'object' &&
            value !== null
          ) {
            const profile = value as AgentProfile;
            updateFields.push(
              `"${key}" = ROW($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3})`
            );
            updateValues.push(profile?.name ?? null);
            updateValues.push(profile?.group ?? null);
            updateValues.push(profile?.description ?? null);
            updateValues.push(profile?.contexts ?? null);
            paramIndex += 4;
          }
          // Handle graph composite type (max_steps, max_iterations, max_retries, execution_timeout_ms, max_token_usage, model)
          else if (
            key === 'graph' &&
            typeof value === 'object' &&
            value !== null
          ) {
            const graph = value as GraphConfig;
            updateFields.push(
              `"${key}" = ROW($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, ROW($${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})::model_config)::graph_config`
            );
            updateValues.push(graph?.max_steps ?? null);
            updateValues.push(graph?.max_iterations ?? null);
            updateValues.push(graph?.max_retries ?? null);
            updateValues.push(graph?.execution_timeout_ms ?? null);
            updateValues.push(graph?.max_token_usage ?? null);
            updateValues.push(graph?.model?.provider ?? null);
            updateValues.push(graph?.model?.model_name ?? null);
            updateValues.push(graph?.model?.temperature ?? null);
            updateValues.push(graph?.model?.max_tokens ?? null);
            paramIndex += 9;
          }
          // Handle memory composite type (ltm_enabled, size_limits, thresholds, timeouts, strategy)
          else if (
            key === 'memory' &&
            typeof value === 'object' &&
            value !== null
          ) {
            const memory = value as AgentConfig.Input['memory'];
            updateFields.push(
              `"${key}" = ROW($${paramIndex}, ROW($${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})::memory_size_limits, ROW($${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9})::memory_thresholds, ROW($${paramIndex + 10}, $${paramIndex + 11})::memory_timeouts, $${paramIndex + 12})::memory_config`
            );
            updateValues.push(memory?.ltm_enabled ?? null);
            updateValues.push(
              memory?.size_limits?.short_term_memory_size ?? null
            );
            updateValues.push(
              memory?.size_limits?.max_insert_episodic_size ?? null
            );
            updateValues.push(
              memory?.size_limits?.max_insert_semantic_size ?? null
            );
            updateValues.push(
              memory?.size_limits?.max_retrieve_memory_size ?? null
            );
            updateValues.push(
              memory?.size_limits?.limit_before_summarization ?? null
            );
            updateValues.push(
              memory?.thresholds?.insert_semantic_threshold ?? null
            );
            updateValues.push(
              memory?.thresholds?.insert_episodic_threshold ?? null
            );
            updateValues.push(
              memory?.thresholds?.retrieve_memory_threshold ?? null
            );
            updateValues.push(memory?.thresholds?.hitl_threshold ?? null);
            updateValues.push(
              memory?.timeouts?.retrieve_memory_timeout_ms ?? null
            );
            updateValues.push(
              memory?.timeouts?.insert_memory_timeout_ms ?? null
            );
            updateValues.push(memory?.strategy ?? null);
            paramIndex += 13;
          }
          // Handle rag composite type (enabled, top_k)
          else if (
            key === 'rag' &&
            typeof value === 'object' &&
            value !== null
          ) {
            const rag = value as AgentConfig.Input['rag'];
            updateFields.push(
              `"${key}" = ROW($${paramIndex}, $${paramIndex + 1})`
            );
            updateValues.push(rag?.enabled ?? null);
            updateValues.push(rag?.top_k ?? null);
            paramIndex += 2;
          }
          // Handle regular fields (prompts_id, mcp_servers, plugins, etc.)
          else {
            updateFields.push(`"${key}" = $${paramIndex}`);
            updateValues.push(value);
            paramIndex++;
          }
        });

        if (updateFields.length === 0) {
          return JSON.stringify({
            success: false,
            message: 'No valid fields to update',
          });
        }

        let whereClause: string;
        if (searchBy === 'id') {
          whereClause = `WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`;
          updateValues.push(input.identifier);
          updateValues.push(userId);
        } else {
          whereClause = `WHERE (profile).name = $${paramIndex} AND user_id = $${paramIndex + 1}`;
          updateValues.push(input.identifier);
          updateValues.push(userId);
        }

        const updateQuery = new Postgres.Query(
          `WITH updated AS (
            UPDATE agents
            SET ${updateFields.join(', ')}
            ${whereClause}
            RETURNING *
          )
          SELECT
            id,
            user_id,
            row_to_json(profile)        AS profile,
            mcp_servers,
            prompts_id,
            row_to_json(graph)          AS graph,
            row_to_json(memory)         AS memory,
            row_to_json(rag)            AS rag,
            created_at,
            updated_at,
            avatar_image,
            avatar_mime_type
          FROM updated`,
          updateValues
        );

        const result =
          await Postgres.query<AgentConfig.OutputWithId>(updateQuery);

        if (result.length > 0) {
          logger.info(`Updated agent "${agent.profile.name}" successfully`);

          // Update Redis cache
          try {
            await redisAgents.updateAgent(result[0]);
            logger.debug(`Agent ${result[0].id} updated in Redis`);
          } catch (error) {
            logger.error(`Failed to update agent in Redis: ${error}`);
            // Don't throw here, Redis is a cache, PostgreSQL is the source of truth
          }

          let message = `Agent "${agent.profile.name}" updated successfully`;
          if (appliedDefaults.length > 0) {
            message += `. Note: ${appliedDefaults.join('; ')}`;
          }

          return JSON.stringify({
            success: true,
            message: message,
            data: result[0],
          });
        } else {
          return JSON.stringify({
            success: false,
            message: 'Failed to update agent',
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
