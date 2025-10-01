import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { normalizeNumericValues } from './normalizeAgentValues.js';
import { UpdateAgentSchema, UpdateAgentInput } from './schemas/index.js';

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

        // First, find the agent
        let findQuery: Postgres.Query;
        const searchBy = input.searchBy || 'name';

        if (searchBy === 'id') {
          const id = parseInt(input.identifier);
          if (isNaN(id)) {
            return JSON.stringify({
              success: false,
              message: `Invalid ID format: ${input.identifier}`,
            });
          }
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE id = $1 AND user_id = $2',
            [id, userId]
          );
        } else {
          findQuery = new Postgres.Query(
            'SELECT * FROM agents WHERE (profile).name = $1 AND user_id = $2',
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
        if (agent.profile.group === 'system') {
          return JSON.stringify({
            success: false,
            message:
              'Cannot update agent from "system" group - this agent is protected.',
          });
        }

        const updates = input.updates;

        // Validate updates before processing
        if (updates.profile?.group === 'system') {
          return JSON.stringify({
            success: false,
            message: 'Cannot update agent to "system" group - this group is protected.',
          });
        }

        if (updates.profile?.name && updates.profile.name.toLowerCase().includes('supervisor agent')) {
          return JSON.stringify({
            success: false,
            message: 'Agent name cannot contain "supervisor agent" - this name is reserved.',
          });
        }

        // Start with the complete existing agent configuration
        const mergedConfig: AgentConfig.Input = { ...agent };

        // Apply updates to the merged configuration (overwrite existing values)
        Object.entries(updates).forEach(([key, value]) => {
          // Skip the entire field if it's null or undefined
          if (value === undefined || value === null) {
            return;
          }

          if (key === 'memory' && typeof value === 'object' && value !== null) {
            const existingMemory: AgentConfig.Input['memory'] | undefined =
              agent.memory;
            const memoryUpdate = value as Partial<AgentConfig.Input['memory']>;
            const filteredMemoryUpdate = Object.fromEntries(
              Object.entries(memoryUpdate).filter(
                ([_, val]) => val !== null && val !== undefined
              )
            ) as Partial<AgentConfig.Input['memory']>;

            if (Object.keys(filteredMemoryUpdate).length > 0) {
              mergedConfig.memory = {
                ...existingMemory,
                ...filteredMemoryUpdate,
              } as AgentConfig.Input['memory'];
            }
          } else if (
            key === 'rag' &&
            typeof value === 'object' &&
            value !== null
          ) {
            const existingRag: AgentConfig.Input['rag'] | undefined = agent.rag;
            const ragUpdate = value as Partial<AgentConfig.Input['rag']>;
            const filteredRagUpdate = Object.fromEntries(
              Object.entries(ragUpdate as Record<string, any>).filter(
                ([_, val]) => val !== null && val !== undefined
              )
            ) as Partial<AgentConfig.Input['rag']>;

            if (
              filteredRagUpdate &&
              Object.keys(filteredRagUpdate).length > 0
            ) {
              mergedConfig.rag = {
                ...existingRag,
                ...filteredRagUpdate,
              } as AgentConfig.Input['rag'];
            }
          } else {
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

          if (key === 'memory' && typeof value === 'object' && value !== null) {
            const memory = value as AgentConfig.Input['memory'];
            updateFields.push(
              `"${key}" = ROW($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`
            );
            updateValues.push(memory?.ltm_enabled ?? null);
            updateValues.push(JSON.stringify(memory?.size_limits ?? null));
            updateValues.push(JSON.stringify(memory?.thresholds ?? null));
            paramIndex += 3;
          } else if (
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
          } else {
            // Handle regular fields
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
          updateValues.push(parseInt(input.identifier));
          updateValues.push(userId);
        } else {
          whereClause = `WHERE (profile).name = $${paramIndex} AND user_id = $${paramIndex + 1}`;
          updateValues.push(input.identifier);
          updateValues.push(userId);
        }

        const updateQuery = new Postgres.Query(
          `UPDATE agents SET ${updateFields.join(', ')} ${whereClause} RETURNING *`,
          updateValues
        );

        const result = await Postgres.query<AgentConfig.Input>(updateQuery);

        if (result.length > 0) {
          logger.info(`Updated agent "${agent.profile.name}" successfully`);

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
