import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { logger } from '@snakagent/core';
import { AgentConfig } from '@snakagent/core';

/**
 * Schema definition for creating a new agent
 * Validates and describes the required and optional parameters for agent creation
 */
const CreateAgentSchema = z.object({
  name: z
    .string()
    .describe(
      'The name of the new agent to create (extract from user request)'
    ),
  group: z
    .string()
    .describe(
      'The group/category of the agent (e.g., "trading", "rpc", "general")'
    ),
  description: z
    .string()
    .describe('A clear description of what the agent does and its purpose'),
  lore: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Optional background story or lore entries for the agent'),
  objectives: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Optional specific goals and objectives for the agent'),
  knowledge: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Optional knowledge base entries that the agent should know'),
  system_prompt: z
    .string()
    .optional()
    .nullable()
    .describe('Optional custom system prompt to define agent behavior'),
  interval: z
    .number()
    .optional()
    .nullable()
    .describe('Execution interval in seconds (default: 5)'),
  plugins: z
    .array(z.string())
    .optional()
    .nullable()
    .describe('Optional list of plugins to enable for this agent'),
  documents: z
    .object({
      enabled: z.boolean().optional().nullable(),
      embeddingModel: z.string().optional().nullable(),
    })
    .optional()
    .nullable()
    .describe('Optional document configuration'),
  mode: z
    .string()
    .optional()
    .nullable()
    .describe(
      'Agent execution mode: "interactive", "autonomous", or "hybrid" (default: interactive)'
    ),
  max_iterations: z
    .number()
    .optional()
    .nullable()
    .describe('Maximum number of iterations per execution cycle (default: 15)'),
});

/**
 * Tool for creating new agent configurations in the database
 * @type {DynamicStructuredTool}
 */
export const createAgentTool = new DynamicStructuredTool({
  name: 'create_agent',
  description:
    'Create/add/make a new agent configuration. Use when user wants to create, add, or make a new agent with specified properties.',
  schema: CreateAgentSchema,
  func: async (input) => {
    try {
      const query = new Postgres.Query(
        `INSERT INTO agents (
			    name, "group", description, lore, objectives, knowledge,
          system_prompt, interval, plugins, memory, documents, mode, max_iterations
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ROW($10, $11), ROW($12, $13), $14, $15)
          RETURNING *`,
        [
          input.name,
          input.group,
          input.description,
          input.lore || '',
          input.objectives || '',
          input.knowledge || '',
          input.system_prompt || null,
          input.interval || 5,
          input.plugins || null,
          JSON.stringify({
            enabled: true,
            shortTermMemorySize: 5,
          }),
          input.documents?.enabled || false,
          input.documents?.embeddingModel || null,
          input.mode || 'interactive',
          input.max_iterations || 15,
        ]
      );

      const result = await Postgres.query<AgentConfig>(query);

      if (result.length > 0) {
        logger.info(`Created new agent "${input.name}" successfully`);
        return JSON.stringify({
          success: true,
          message: `Agent "${input.name}" created successfully`,
          data: result[0],
        });
      } else {
        return JSON.stringify({
          success: false,
          message: 'Failed to create agent - no data returned',
        });
      }
    } catch (error) {
      logger.error(`Error creating agent: ${error}`);
      return JSON.stringify({
        success: false,
        message: 'Failed to create agent',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
