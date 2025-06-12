import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

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
        findQuery = new Postgres.Query('SELECT * FROM agents WHERE id = $1', [
          input.identifier,
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

      // Build dynamic update query
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
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

      updateValues.push(agent.id);
      const updateQuery = new Postgres.Query(
        `UPDATE agents SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
        updateValues
      );

      const result = await Postgres.query<AgentConfig>(updateQuery);

      if (result.length > 0) {
        logger.info(`Updated agent "${agent.name}" successfully`);
        return JSON.stringify({
          success: true,
          message: `Agent "${agent.name}" updated successfully`,
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
