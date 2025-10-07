import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import {
  AgentConfig,
  DEFAULT_AGENT_CONFIG,
  McpServerConfig,
  logger,
} from '@snakagent/core';
import {
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@prompts/index.js';
import { normalizeNumericValues } from './normalizeAgentValues.js';
import { CreateAgentSchema, CreateAgentInput } from './schemas/index.js';

const RESERVED_GROUP = 'system';
const RESERVED_NAME = 'supervisor agent';

export function createAgentTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'create_agent',
    description:
      'Create/add/make a new agent configuration for a specific user. Provide the agent profile (name, group, description) and optional configuration overrides for graph, memory, rag, plugins, mcp_servers, and prompts.',
    schema: CreateAgentSchema,
    func: async (rawInput) => {
      let input: CreateAgentInput;
      try {
        input = CreateAgentSchema.parse(rawInput);
      } catch (validationError) {
        const errorMessage =
          validationError instanceof Error
            ? validationError.message
            : 'Invalid create agent payload';
        return JSON.stringify({
          success: false,
          message: 'Validation failed for create_agent input',
          error: errorMessage,
        });
      }

      try {
        const userId = agentConfig.user_id;

        const trimmedName = input.profile.name.trim();
        const trimmedGroup = input.profile.group.trim();

        if (trimmedName.toLowerCase().includes(RESERVED_NAME)) {
          return JSON.stringify({
            success: false,
            message:
              'The name "supervisor agent" is reserved and cannot be used for new agents.',
          });
        }

        if (trimmedGroup.toLowerCase() === RESERVED_GROUP) {
          return JSON.stringify({
            success: false,
            message:
              'The group "system" is reserved and cannot be used for new agents.',
          });
        }

        const agentConfigData = buildAgentConfigFromInput(input);
        const notes: string[] = [];

        const { name: uniqueName, note: nameNote } =
          await resolveUniqueAgentName(
            agentConfigData.profile.name,
            trimmedGroup
          );
        agentConfigData.profile.name = uniqueName;
        if (nameNote) {
          notes.push(nameNote);
        }

        const promptId = await ensurePromptsId(userId, input.prompts_id);
        if (!input.prompts_id) {
          notes.push('Default prompts initialized for the user.');
        }

        agentConfigData.prompts_id = promptId;

        const payload: Record<string, unknown> = {
          ...agentConfigData,
        };

        const insertQuery = new Postgres.Query(
          'SELECT * FROM insert_agent_from_json($1, $2)',
          [userId, JSON.stringify(payload)]
        );

        const result =
          await Postgres.query<AgentConfig.OutputWithId>(insertQuery);

        if (result.length === 0) {
          logger.error(
            'Failed to create agent: insert_agent_from_json returned no rows'
          );
          return JSON.stringify({
            success: false,
            message:
              'Failed to create agent - database insertion no data returned',
          });
        }

        const createdAgent = result[0];
        const noteSuffix =
          notes.length > 0 ? `. Note: ${[...new Set(notes)].join('; ')}` : '';

        logger.info(
          `Created new agent "${createdAgent.profile.name}" for user ${userId}`
        );

        return JSON.stringify({
          success: true,
          message: `Agent "${createdAgent.profile.name}" created successfully${noteSuffix}`,
          data: createdAgent,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Error creating agent: ${errorMessage}`);
        return JSON.stringify({
          success: false,
          message: 'Failed to create agent',
          error: errorMessage,
        });
      }
    },
  });
}

function buildAgentConfigFromInput(input: CreateAgentInput): AgentConfig.Input {
  // Build partial config from input - normalizeNumericValues will handle the rest
  const partialConfig: Partial<AgentConfig.Input> = {};

  // Only add properties that are actually provided
  if (input.profile) {
    partialConfig.profile = {
      name: input.profile.name.trim(),
      group: input.profile.group.trim(),
      description: input.profile.description.trim(),
      contexts: input.profile.contexts || [],
    };
  }

  if (input.mcp_servers)
    partialConfig.mcp_servers = parseMcpServers(input.mcp_servers, {});

  if (input.graph)
    partialConfig.graph = input.graph as AgentConfig.Input['graph'];

  if (input.memory)
    partialConfig.memory = input.memory as AgentConfig.Input['memory'];

  if (input.rag) partialConfig.rag = input.rag;

  if (input.prompts_id) partialConfig.prompts_id = input.prompts_id;

  // Apply normalization using the centralized function - it handles all defaults and validation
  const { normalizedConfig, appliedDefaults } =
    normalizeNumericValues(partialConfig);

  // Log any applied defaults for debugging
  if (appliedDefaults.length > 0) {
    logger.info(
      `Applied defaults during agent creation: ${appliedDefaults.join(', ')}`
    );
  }

  return normalizedConfig;
}

function parseMcpServers(
  value: Record<string, McpServerConfig> | undefined,
  fallback: Record<string, McpServerConfig>
): Record<string, McpServerConfig> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return { ...fallback };
}

async function resolveUniqueAgentName(
  baseName: string,
  group: string
): Promise<{ name: string; note?: string }> {
  const query = new Postgres.Query(
    `SELECT (profile).name FROM agents WHERE (profile)."group" = $1 AND ((profile).name = $2 OR (profile).name LIKE $2 || '-%') ORDER BY LENGTH((profile).name) DESC, (profile).name DESC LIMIT 1`,
    [group, baseName]
  );

  const result = await Postgres.query<{ name: string }>(query);
  if (result.length === 0) {
    return { name: baseName };
  }

  const existingName = result[0].name;
  if (existingName === baseName) {
    return {
      name: `${baseName}-1`,
      note: `Name already existed in group "${group}"; assigned next suffix.`,
    };
  }

  const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = existingName.match(new RegExp(`^${escapedBase}-(\\d+)$`));
  if (match && match[1]) {
    const nextIndex = parseInt(match[1], 10) + 1;
    return {
      name: `${baseName}-${nextIndex}`,
      note: `Name already existed in group "${group}"; assigned next suffix.`,
    };
  }

  return {
    name: `${baseName}-1`,
    note: `Name collision detected; defaulted to suffix "-1".`,
  };
}

async function ensurePromptsId(
  userId: string,
  providedId?: string | null
): Promise<string> {
  if (providedId) {
    return providedId;
  }

  const existingQuery = new Postgres.Query(
    'SELECT id FROM prompts WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  const existing = await Postgres.query<{ id: string }>(existingQuery);
  if (existing.length > 0) {
    return existing[0].id;
  }

  const insertQuery = new Postgres.Query(
    `INSERT INTO prompts (
      user_id,
      task_executor_prompt,
      task_manager_prompt,
      task_verifier_prompt,
      task_memory_manager_prompt,
      public
    ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      userId,
      TASK_EXECUTOR_SYSTEM_PROMPT,
      TASK_MANAGER_SYSTEM_PROMPT,
      TASK_VERIFIER_SYSTEM_PROMPT,
      TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
      false,
    ]
  );

  const created = await Postgres.query<{ id: string }>(insertQuery);
  if (created.length === 0) {
    throw new Error('Failed to create default prompts for the user');
  }

  return created[0].id;
}
