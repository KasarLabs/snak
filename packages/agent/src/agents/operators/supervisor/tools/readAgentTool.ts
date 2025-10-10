import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';
import { SelectAgentSchema } from './schemas/common.schemas.js';

const ReadAgentSchema = SelectAgentSchema;

export function readAgentTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'read_agent',
    description:
      'Get/retrieve/show/view/find details and configuration of a specific agent by ID or name. Use when user wants to see information about a particular agent.',
    schema: ReadAgentSchema,
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

        let query: Postgres.Query;
        const searchBy = input.searchBy === 'id' ? 'id' : 'name';

        if (searchBy === 'id') {
          query = new Postgres.Query(
            `SELECT ${selectColumns.join(', ')} FROM agents WHERE id = $1 AND user_id = $2`,
            [input.identifier, userId]
          );
        } else {
          query = new Postgres.Query(
            `SELECT ${selectColumns.join(', ')} FROM agents WHERE (profile).name = $1 AND user_id = $2`,
            [input.identifier, userId]
          );
        }

        const result =
          await Postgres.query<AgentConfig.OutputWithoutUserId>(query);

        if (result.length > 0) {
          return JSON.stringify({
            success: true,
            message: 'Agent configuration retrieved successfully',
            data: result[0],
          });
        } else {
          return JSON.stringify({
            success: false,
            message: `Agent not found with ${searchBy}: ${input.identifier}`,
          });
        }
      } catch (error) {
        logger.error(`Error reading agent: ${error}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to read agent configuration',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}
