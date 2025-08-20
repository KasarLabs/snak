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
      lore: z
        .array(z.string())
        .optional()
        .nullable()
        .describe('New lore entries (background story elements)'),
      objectives: z
        .array(z.string())
        .optional()
        .nullable()
        .describe('New objectives (goals for the agent)'),
      knowledge: z
        .array(z.string())
        .optional()
        .nullable()
        .describe('New knowledge entries (information the agent should know)'),
      system_prompt: z
        .string()
        .optional()
        .nullable()
        .describe(
          'New system prompt (use when user wants to change agent behavior/prompt)'
        ),
      interval: z
        .number()
        .optional()
        .nullable()
        .describe('New execution interval in milliseconds'),
      plugins: z
        .array(z.string())
        .optional()
        .nullable()
        .describe('New plugins list'),
      memory: z
        .object({
          enabled: z.boolean().optional().nullable(),
          shortTermMemorySize: z.number().optional().nullable(),
          memorySize: z.number().optional().nullable(),
        })
        .optional()
        .nullable()
        .describe('New memory configuration object'),
      rag: z
        .object({
          enabled: z.boolean().optional().nullable(),
          embeddingModel: z.string().optional().nullable(),
        })
        .optional()
        .nullable()
        .describe('New RAG configuration object'),
      mode: z
        .string()
        .optional()
        .nullable()
        .describe('New agent mode (execution mode)'),
      max_iterations: z
        .number()
        .optional()
        .nullable()
        .describe('New maximum iterations limit'),
    })
    .describe('Object containing only the fields that need to be updated'),
});

export const updateAgentTool = new DynamicStructuredTool({
  name: 'update_agent',
  description:
    'Update/modify/change/rename specific properties of an existing agent configuration. Use when user wants to modify, change, update, edit, or rename any agent property like name, description, group, etc.',
  schema: UpdateAgentSchema,
  func: async (input) => {
    try {
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
        findQuery = new Postgres.Query('SELECT * FROM agents WHERE id = $1', [
          id,
        ]);
      } else {
        findQuery = new Postgres.Query('SELECT * FROM agents WHERE name = $1', [
          input.identifier,
        ]);
      }

      const existingAgent = await Postgres.query<AgentConfig>(findQuery);
      if (existingAgent.length === 0) {
        return JSON.stringify({
          success: false,
          message: `Agent not found with ${searchBy}: ${input.identifier}`,
        });
      }

      const agent = existingAgent[0];
      const updates = input.updates;

      const fieldsToUpdate: Partial<AgentConfig> = {};
      Object.entries(updates).forEach(([key, value]) => {
        // Skip the entire field if it's null or undefined
        if (value === undefined || value === null) {
          return;
        }
        
        if (key === 'memory' && typeof value === 'object' && value !== null) {
          const existingMemory: AgentConfig['memory'] | undefined = agent.memory;
          const memoryUpdate = value as Partial<AgentConfig['memory']>;
          const filteredMemoryUpdate = Object.fromEntries(
            Object.entries(memoryUpdate).filter(([_, val]) => val !== null && val !== undefined)
          ) as Partial<AgentConfig['memory']>;
          
          if (Object.keys(filteredMemoryUpdate).length > 0) {
            fieldsToUpdate.memory = { ...existingMemory, ...filteredMemoryUpdate } as AgentConfig['memory'];
          }
        } else if (key === 'rag' && typeof value === 'object' && value !== null) {
          const existingRag: AgentConfig['rag'] | undefined = agent.rag;
          const ragUpdate = value as Partial<AgentConfig['rag']>;
          const filteredRagUpdate = Object.fromEntries(
            Object.entries(ragUpdate as Record<string, any>).filter(([_, val]) => val !== null && val !== undefined)
          ) as Partial<AgentConfig['rag']>;
          
          if (filteredRagUpdate && Object.keys(filteredRagUpdate).length > 0) {
            fieldsToUpdate.rag = { ...existingRag, ...filteredRagUpdate } as AgentConfig['rag'];
          }
        } else {
          (fieldsToUpdate as any)[key] = value;
        }
      });

      const { normalizedConfig: normalizedUpdates, appliedDefaults } =
        normalizeNumericValues(fieldsToUpdate);

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      Object.keys(fieldsToUpdate).forEach((key) => {
        const value = normalizedUpdates[key as keyof typeof normalizedUpdates];
        
        if (key === 'memory' && typeof value === 'object' && value !== null) {
          const memory = value as AgentConfig['memory'];
          updateFields.push(`"${key}" = ROW($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2})`);
          updateValues.push(
            memory?.enabled ?? null,
            memory?.shortTermMemorySize ?? null,
            memory?.memorySize ?? null
          );
          paramIndex += 3;
        } else if (key === 'rag' && typeof value === 'object' && value !== null) {
          const rag = value as AgentConfig['rag'];
          updateFields.push(`"${key}" = ROW($${paramIndex}, $${paramIndex + 1})`);
          updateValues.push(
            rag?.enabled ?? null,
            (rag as any)?.embeddingModel ?? null
          );
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
        whereClause = `WHERE id = $${paramIndex}`;
        updateValues.push(parseInt(input.identifier));
      } else {
        whereClause = `WHERE name = $${paramIndex}`;
        updateValues.push(input.identifier);
      }

      const updateQuery = new Postgres.Query(
        `UPDATE agents SET ${updateFields.join(', ')} ${whereClause} RETURNING *`,
        updateValues
      );

      const result = await Postgres.query<AgentConfig>(updateQuery);

      if (result.length > 0) {
        logger.info(`Updated agent "${agent.name}" successfully`);

        let message = `Agent "${agent.name}" updated successfully`;
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
