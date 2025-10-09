import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger, AgentConfig } from '@snakagent/core';

const normalizePositiveNumber = (val: number | null | undefined) =>
  val !== null && val !== undefined && val <= 0 ? null : val;

const ListAgentsSchema = z.object({
  filters: z
    .object({
      group: z
        .string()
        .optional()
        .describe(
          'Filter agents by specific group (use when user wants agents from a particular group)'
        ),
      mode: z
        .string()
        .optional()
        .describe(
          'Filter agents by execution mode (use when user wants agents with specific mode)'
        ),
      name_contains: z
        .string()
        .optional()
        .describe(
          'Filter agents whose names contain this text (use for partial name searches)'
        ),
    })
    .optional()
    .describe('Optional filters to narrow down the agent list'),
  limit: z
    .number()
    .optional()
    .transform(normalizePositiveNumber)
    .describe(
      'Maximum number of agents to return (use when user specifies a limit)'
    ),
  offset: z
    .number()
    .optional()
    .transform(normalizePositiveNumber)
    .describe('Number of agents to skip for pagination'),
});

export function listAgentsTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'list_agents',
    description:
      'List/show/get all agent configurations with optional filtering. Use when user wants to see multiple agents, all agents, or find agents matching certain criteria.',
    schema: ListAgentsSchema,
    func: async (input) => {
      try {
        const userId = agentConfig.user_id;

        const selectColumns = [
          'id',
          'row_to_json(profile) as profile',
          'mcp_servers as "mcp_servers"',
          'prompts_id',
          'row_to_json(graph) as graph',
          'row_to_json(memory) as memory',
          'row_to_json(rag) as rag',
          `CASE
    WHEN avatar_image IS NOT NULL AND avatar_mime_type IS NOT NULL
    THEN CONCAT('data:', avatar_mime_type, ';base64,', encode(avatar_image, 'base64'))
    ELSE NULL
  END as "avatarUrl"`,
          'avatar_mime_type',
          'created_at',
          'updated_at',
        ];

        const whereConditions: string[] = ['user_id = $1'];
        const values: any[] = [userId];
        let paramIndex = 2;

        if (input.filters) {
          const { group, mode, name_contains } = input.filters;

          if (group !== null && group !== undefined && group !== '') {
            whereConditions.push(`(profile)."group" = $${paramIndex}`);
            values.push(group);
            paramIndex++;
          }

          if (mode !== null && mode !== undefined && mode !== '') {
            whereConditions.push(`mode = $${paramIndex}`);
            values.push(mode);
            paramIndex++;
          }

          if (
            name_contains !== null &&
            name_contains !== undefined &&
            name_contains !== ''
          ) {
            whereConditions.push(`(profile).name ILIKE $${paramIndex}`);
            values.push(`%${name_contains}%`);
            paramIndex++;
          }
        }

        let queryString = `SELECT\n  ${selectColumns.join(',\n  ')}\nFROM agents`;
        if (whereConditions.length > 0) {
          queryString += `\nWHERE ${whereConditions.join(' AND ')}`;
        }
        queryString += `\nORDER BY (profile).name`;

        if (input.limit !== null && input.limit !== undefined) {
          queryString += `\nLIMIT $${paramIndex}`;
          values.push(input.limit);
          paramIndex++;
        }

        if (input.offset !== null && input.offset !== undefined) {
          queryString += `\nOFFSET $${paramIndex}`;
          values.push(input.offset);
        }

        const query = new Postgres.Query(queryString, values);
        const result = await Postgres.query<AgentConfig.OutputWithId>(query);

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
}
