import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Postgres } from '@snakagent/database';
import { AgentConfig, DEFAULT_AGENT_CONFIG, logger } from '@snakagent/core';
import {
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@prompts/index.js';

const RESERVED_GROUP = 'system';

const CreateAgentSchema = z
  .object({
    name: z.string().min(1).describe('The display name of the agent to create'),
    group: z
      .string()
      .min(1)
      .describe('The functional group/category for the agent'),
    description: z
      .string()
      .min(1)
      .describe('A concise description of what the agent does'),
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
      .describe('Optional overrides for the agent graph configuration'),
    memory: z
      .record(z.unknown())
      .optional()
      .describe('Optional overrides for the agent memory configuration'),
    rag: z
      .record(z.unknown())
      .optional()
      .describe('Optional overrides for the agent RAG configuration'),
    avatar_image: z
      .string()
      .optional()
      .nullable()
      .describe('Optional base64 encoded avatar image'),
    avatar_mime_type: z
      .string()
      .optional()
      .nullable()
      .describe('Optional MIME type of the avatar image'),
  })
  .strict();

type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export function createAgentTool(
  agentConfig: AgentConfig.Runtime
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'create_agent',
    description:
      'Create/add/make a new agent configuration for a specific user. Provide the desired name, group, description, and optional overrides (graph, memory, rag, prompts).',
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
        const trimmedName = input.name.trim();
        const trimmedGroup = input.group.trim();

        if (trimmedGroup.toLowerCase() === RESERVED_GROUP) {
          return JSON.stringify({
            success: false,
            message:
              'The group "system" is reserved and cannot be used for new agents.',
          });
        }

        const agentConfigData = buildAgentConfigFromInput(
          input,
          trimmedName,
          trimmedGroup
        );
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

        if (input.avatar_image) {
          payload.avatar_image = input.avatar_image;
        }
        if (input.avatar_mime_type) {
          payload.avatar_mime_type = input.avatar_mime_type;
        }

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
            message: 'Failed to create agent - no data returned',
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

function buildAgentConfigFromInput(
  input: CreateAgentInput,
  name: string,
  group: string
): AgentConfig.Input {
  const config: AgentConfig.Input = JSON.parse(
    JSON.stringify(DEFAULT_AGENT_CONFIG)
  );

  config.profile = {
    name,
    group,
    description: input.description.trim(),
    contexts: parseStringArray(input.contexts, []),
  };

  config.plugins = parseStringArray(input.plugins, []);
  config.mcp_servers = parseRecord(input.mcp_servers, {});

  config.graph = applyGraphOverrides(config.graph, input.graph);
  config.memory = applyMemoryOverrides(config.memory, input.memory);
  config.rag = applyRagOverrides(config.rag, input.rag);

  return config;
}

function applyGraphOverrides(
  baseGraph: AgentConfig.Input['graph'],
  overrides?: Record<string, unknown>
): AgentConfig.Input['graph'] {
  if (!overrides) {
    return baseGraph;
  }

  const nextGraph = { ...baseGraph };

  assignPositiveInt(
    nextGraph,
    overrides,
    ['max_steps', 'maxSteps'],
    'graph.max_steps'
  );
  assignPositiveInt(
    nextGraph,
    overrides,
    ['max_iterations', 'maxIterations'],
    'graph.max_iterations'
  );
  assignNonNegativeInt(
    nextGraph,
    overrides,
    ['max_retries', 'maxRetries'],
    'graph.max_retries'
  );
  assignPositiveInt(
    nextGraph,
    overrides,
    ['execution_timeout_ms', 'executionTimeoutMs'],
    'graph.execution_timeout_ms'
  );
  assignPositiveInt(
    nextGraph,
    overrides,
    ['max_token_usage', 'maxTokenUsage'],
    'graph.max_token_usage'
  );

  const modelOverride = getObjectOverride(overrides, ['model', 'modelConfig']);
  if (modelOverride) {
    const nextModel = { ...nextGraph.model };

    const provider = getStringOverride(modelOverride, [
      'provider',
      'model_provider',
    ]);
    if (provider) {
      nextModel.provider = provider;
    }

    const modelName = getStringOverride(modelOverride, [
      'model_name',
      'modelName',
    ]);
    if (modelName) {
      nextModel.model_name = modelName;
    }

    const temperature = parseNumberValue(
      getOverrideValue(modelOverride, ['temperature']),
      'graph.model.temperature'
    );
    if (temperature !== undefined) {
      nextModel.temperature = temperature;
    }

    const maxTokens = parsePositiveInt(
      getOverrideValue(modelOverride, ['max_tokens', 'maxTokens']),
      'graph.model.max_tokens'
    );
    if (maxTokens !== undefined) {
      nextModel.max_tokens = maxTokens;
    }

    nextGraph.model = nextModel;
  }

  return nextGraph;
}

function applyMemoryOverrides(
  baseMemory: AgentConfig.Input['memory'],
  overrides?: Record<string, unknown>
): AgentConfig.Input['memory'] {
  if (!overrides) {
    return baseMemory;
  }

  const nextMemory: AgentConfig.Input['memory'] = JSON.parse(
    JSON.stringify(baseMemory)
  );

  const ltmEnabled = parseBooleanValue(
    getOverrideValue(overrides, ['ltm_enabled', 'ltmEnabled']),
    'memory.ltm_enabled'
  );
  if (ltmEnabled !== undefined) {
    nextMemory.ltm_enabled = ltmEnabled;
  }

  const strategy = getStringOverride(overrides, ['strategy']);
  if (strategy) {
    nextMemory.strategy = strategy as AgentConfig.Input['memory']['strategy'];
  }

  const sizeLimits = getObjectOverride(overrides, [
    'size_limits',
    'sizeLimits',
  ]);
  if (sizeLimits) {
    assignPositiveInt(
      nextMemory.size_limits,
      sizeLimits,
      ['short_term_memory_size', 'shortTermMemorySize'],
      'memory.size_limits.short_term_memory_size'
    );
    assignPositiveInt(
      nextMemory.size_limits,
      sizeLimits,
      ['max_insert_episodic_size', 'maxInsertEpisodicSize'],
      'memory.size_limits.max_insert_episodic_size'
    );
    assignPositiveInt(
      nextMemory.size_limits,
      sizeLimits,
      ['max_insert_semantic_size', 'maxInsertSemanticSize'],
      'memory.size_limits.max_insert_semantic_size'
    );
    assignPositiveInt(
      nextMemory.size_limits,
      sizeLimits,
      ['max_retrieve_memory_size', 'maxRetrieveMemorySize'],
      'memory.size_limits.max_retrieve_memory_size'
    );
    assignPositiveInt(
      nextMemory.size_limits,
      sizeLimits,
      ['limit_before_summarization', 'limitBeforeSummarization'],
      'memory.size_limits.limit_before_summarization'
    );
  }

  const thresholds = getObjectOverride(overrides, ['thresholds']);
  if (thresholds) {
    assignNumber(
      nextMemory.thresholds,
      thresholds,
      ['insert_semantic_threshold', 'insertSemanticThreshold'],
      'memory.thresholds.insert_semantic_threshold'
    );
    assignNumber(
      nextMemory.thresholds,
      thresholds,
      ['insert_episodic_threshold', 'insertEpisodicThreshold'],
      'memory.thresholds.insert_episodic_threshold'
    );
    assignNumber(
      nextMemory.thresholds,
      thresholds,
      ['retrieve_memory_threshold', 'retrieveMemoryThreshold'],
      'memory.thresholds.retrieve_memory_threshold'
    );
    assignNumber(
      nextMemory.thresholds,
      thresholds,
      ['hitl_threshold', 'hitlThreshold'],
      'memory.thresholds.hitl_threshold'
    );
  }

  const timeouts = getObjectOverride(overrides, ['timeouts']);
  if (timeouts) {
    assignPositiveInt(
      nextMemory.timeouts,
      timeouts,
      ['retrieve_memory_timeout_ms', 'retrieveMemoryTimeoutMs'],
      'memory.timeouts.retrieve_memory_timeout_ms'
    );
    assignPositiveInt(
      nextMemory.timeouts,
      timeouts,
      ['insert_memory_timeout_ms', 'insertMemoryTimeoutMs'],
      'memory.timeouts.insert_memory_timeout_ms'
    );
  }

  return nextMemory;
}

function applyRagOverrides(
  baseRag: AgentConfig.Input['rag'],
  overrides?: Record<string, unknown>
): AgentConfig.Input['rag'] {
  if (!overrides) {
    return baseRag;
  }

  const nextRag = { ...baseRag };

  const enabled = parseBooleanValue(
    getOverrideValue(overrides, ['enabled']),
    'rag.enabled'
  );
  if (enabled !== undefined) {
    nextRag.enabled = enabled;
  }

  const topK = parsePositiveInt(
    getOverrideValue(overrides, ['top_k', 'topK']),
    'rag.top_k'
  );
  if (topK !== undefined) {
    nextRag.top_k = topK;
  }

  return nextRag;
}

function parseStringArray(
  value: string[] | null | undefined,
  fallback: string[]
): string[] {
  if (!value) {
    return [...fallback];
  }
  return value.filter(
    (entry) => typeof entry === 'string' && entry.trim().length > 0
  );
}

function parseRecord(
  value: Record<string, unknown> | null | undefined,
  fallback: Record<string, unknown>
): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  return { ...fallback };
}

function getOverrideValue(
  source: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }
  return undefined;
}

function getObjectOverride(
  source: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> | undefined {
  const value = getOverrideValue(source, keys);
  if (!value) {
    return undefined;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected object for ${keys[0]}`);
  }
  return value as Record<string, unknown>;
}

function getStringOverride(
  source: Record<string, unknown>,
  keys: string[]
): string | undefined {
  const value = getOverrideValue(source, keys);
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${keys[0]} must be a string`);
  }
  return value.trim();
}

function assignPositiveInt(
  target: Record<string, any>,
  source: Record<string, unknown>,
  keys: string[],
  fieldName: string
) {
  const value = parsePositiveInt(getOverrideValue(source, keys), fieldName);
  if (value !== undefined) {
    target[keys[0]] = value;
  }
}

function assignNonNegativeInt(
  target: Record<string, any>,
  source: Record<string, unknown>,
  keys: string[],
  fieldName: string
) {
  const value = parseNonNegativeInt(getOverrideValue(source, keys), fieldName);
  if (value !== undefined) {
    target[keys[0]] = value;
  }
}

function assignNumber(
  target: Record<string, any>,
  source: Record<string, unknown>,
  keys: string[],
  fieldName: string
) {
  const value = parseNumberValue(getOverrideValue(source, keys), fieldName);
  if (value !== undefined) {
    target[keys[0]] = value;
  }
}

function parsePositiveInt(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = parseNumeric(value, fieldName);
  if (parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return Math.trunc(parsed);
}

function parseNonNegativeInt(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = parseNumeric(value, fieldName);
  if (parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return Math.trunc(parsed);
}

function parseNumberValue(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return parseNumeric(value, fieldName);
}

function parseNumeric(value: unknown, fieldName: string): number {
  const raw =
    typeof value === 'string' ? Number(value.trim()) : Number(value as number);
  if (!Number.isFinite(raw)) {
    throw new Error(`${fieldName} must be a numeric value`);
  }
  return raw;
}

function parseBooleanValue(
  value: unknown,
  fieldName: string
): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  throw new Error(`${fieldName} must be a boolean value`);
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
      TASK_MEMEMORY_MANAGER_SYSTEM_PROMPT,
      false,
    ]
  );

  const created = await Postgres.query<{ id: string }>(insertQuery);
  if (created.length === 0) {
    throw new Error('Failed to create default prompts for the user');
  }

  return created[0].id;
}
