import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { normalizeNumericValues } from './normalizeAgentValues.js';

const UpdateAgentSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The current agent ID or name to update (extract from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .nullable()
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
  updates: z
    .object({
      name: z
        .string()
        .optional()
        .nullable()
        .describe(
          'New name for the agent (use when user wants to rename/change name)'
        ),
      group: z
        .string()
        .optional()
        .nullable()
        .describe(
          'New group for the agent (use when user wants to change group)'
        ),
      description: z
        .string()
        .optional()
        .nullable()
        .describe(
          'New description (use when user wants to change/update description)'
        ),
      contexts: z
        .array(z.string())
        .optional()
        .nullable()
        .describe('Optional contextual strings for the agent profile'),
      plugins: z
        .array(z.string())
        .optional()
        .nullable()
        .describe('Optional list of plugins to attach to this agent'),
      mcp_servers: z
        .record(z.unknown())
        .optional()
        .nullable()
        .describe('Optional MCP servers configuration object'),
      prompts_id: z
        .string()
        .uuid()
        .optional()
        .nullable()
        .describe('Optional existing prompts configuration identifier'),
      graph: z
        .record(z.unknown())
        .optional()
        .nullable()
        .describe('Optional overrides for the agent graph configuration'),
      memory: z
        .record(z.unknown())
        .optional()
        .nullable()
        .describe('Optional overrides for the agent memory configuration'),
      rag: z
        .record(z.unknown())
        .optional()
        .nullable()
        .describe('Optional overrides for the agent RAG configuration'),
    })
    .describe('Object containing only the fields that need to be updated'),
});

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

        const fieldsToUpdate: Record<string, any> = {};
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
              fieldsToUpdate.memory = {
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
              fieldsToUpdate.rag = {
                ...existingRag,
                ...filteredRagUpdate,
              } as AgentConfig.Input['rag'];
            }
          } else {
            (fieldsToUpdate as any)[key] = value;
          }
        });

        const { normalizedConfig: normalizedUpdates, appliedDefaults } =
          normalizeNumericValues(fieldsToUpdate as any);

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        Object.keys(fieldsToUpdate).forEach((key) => {
          const value =
            normalizedUpdates[key as keyof typeof normalizedUpdates];

          if (key === 'memory' && typeof value === 'object' && value !== null) {
            const memory = value as AgentConfig.Input['memory'];
            updateFields.push(
              `"${key}" = ROW($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`
            );
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
