import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

const normalizePositiveNumber = (val: number | null | undefined) => 
  (val !== null && val !== undefined && val <= 0 ? null : val);

const ListAgentsSchema = z.object({
  filters: z
    .object({
      group: z
        .string()
        .optional()
        .nullable()
        .describe(
          'Filter agents by specific group (use when user wants agents from a particular group)'
        ),
      mode: z
        .string()
        .optional()
        .nullable()
        .describe(
          'Filter agents by execution mode (use when user wants agents with specific mode)'
        ),
      name_contains: z
        .string()
        .optional()
        .nullable()
        .describe(
          'Filter agents whose names contain this text (use for partial name searches)'
        ),
    })
    .optional()
    .nullable()
    .describe('Optional filters to narrow down the agent list'),
  limit: z
    .number()
    .optional()
    .nullable()
    .transform(normalizePositiveNumber)
    .describe(
      'Maximum number of agents to return (use when user specifies a limit)'
    ),
  offset: z
    .number()
    .optional()
    .nullable()
    .transform(normalizePositiveNumber)
    .describe('Number of agents to skip for pagination'),
});

export const listAgentsTool = new DynamicStructuredTool({
  name: 'list_agents',
  description:
    'List/show/get all agent configurations with optional filtering. Use when user wants to see multiple agents, all agents, or find agents matching certain criteria.',
  schema: ListAgentsSchema,
  func: async (input) => {
    try {
      let query: Postgres.Query;
      const whereConditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (input.filters) {
        if (input.filters.group !== null && input.filters.group !== undefined && input.filters.group !== '') {
          whereConditions.push(`"group" = $${paramIndex}`);
          values.push(input.filters.group);
          paramIndex++;
        }
        if (input.filters.mode !== null && input.filters.mode !== undefined && input.filters.mode !== '') {
          whereConditions.push(`"mode" = $${paramIndex}`);
          values.push(input.filters.mode);
          paramIndex++;
        }
        if (input.filters.name_contains !== null && input.filters.name_contains !== undefined && input.filters.name_contains !== '') {
          whereConditions.push(`"name" ILIKE $${paramIndex}`);
          values.push(`%${input.filters.name_contains}%`);
          paramIndex++;
        }
      }

      // Build query
      let queryString = 'SELECT * FROM agents';
      if (whereConditions.length > 0) {
        queryString += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      queryString += ' ORDER BY name';

      // Add LIMIT and OFFSET
      if (input.limit !== null && input.limit !== undefined) {
        queryString += ` LIMIT $${paramIndex}`;
        values.push(input.limit);
        paramIndex++;
      }
      if (input.offset !== null && input.offset !== undefined) {
        queryString += ` OFFSET $${paramIndex}`;
        values.push(input.offset);
      }

      query = new Postgres.Query(queryString, values);
      const result = await Postgres.query<AgentConfig>(query);

      return JSON.stringify({
        success: true,
        message: `Found ${result.length} agent(s)`,
        data: result,
        count: result.length,
      });
    } catch (error) {
      logger.error(`Error listing agents: ${error}`);
      return JSON.stringify({
        success: false,
        message: 'Failed to list agents',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
