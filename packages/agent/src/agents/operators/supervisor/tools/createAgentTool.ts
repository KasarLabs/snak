import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  AgentConfig,
  McpServerConfig,
  logger,
  validateAgent,
  validateAgentQuotas,
  AgentDatabaseInterface,
} from '@snakagent/core';
import {
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@prompts/index.js';
import { normalizeNumericValues } from '../utils/normalizeAgentValues.js';
import { CreateAgentSchema, CreateAgentInput } from './schemas/index.js';
import { redisAgents, agents } from '@snakagent/database/queries';
import { validateAgentProperties } from '../utils/agents.validators.js';

const dbInterface: AgentDatabaseInterface = {
  getTotalAgentsCount: agents.getTotalAgentsCount,
  getUserAgentsCount: agents.getUserAgentsCount,
};

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

        const validation = validateAgentProperties(trimmedName, trimmedGroup);
        if (!validation.isValid) {
          return JSON.stringify({
            success: false,
            message: validation.message,
          });
        }

        const agentConfigData = buildAgentConfigFromInput(input);
        const notes: string[] = [];

        // Validate agent quotas before configuration validation
        try {
          await validateAgentQuotas(userId, dbInterface);
        } catch (quotaError) {
          const errorMessage =
            quotaError instanceof Error
              ? quotaError.message
              : 'Quota validation failed';
          return JSON.stringify({
            success: false,
            message: 'Quota validation failed',
            error: errorMessage,
          });
        }

        // Validate the agent configuration
        try {
          await validateAgent({ ...agentConfigData, user_id: userId }, true);
        } catch (validationError) {
          const errorMessage =
            validationError instanceof Error
              ? validationError.message
              : 'Agent validation failed';
          return JSON.stringify({
            success: false,
            message: 'Agent validation failed',
            error: errorMessage,
          });
        }

        const { name: uniqueName, note: nameNote } =
          await resolveUniqueAgentName(
            agentConfigData.profile.name,
            trimmedGroup,
            userId
          );
        agentConfigData.profile.name = uniqueName;
        if (nameNote) {
          notes.push(nameNote);
        }

        const { id: promptId, created: promptsCreated } = await ensurePromptsId(
          userId,
          input.prompts_id
        );
        if (promptsCreated) {
          notes.push('Default prompts initialized for the user.');
        }

        agentConfigData.prompts_id = promptId;

        // Insert into database
        const createdAgent = await agents.insertAgentFromJson(
          userId,
          agentConfigData
        );

        if (!createdAgent) {
          logger.error(
            'Failed to create agent: insert_agent_from_json returned no rows'
          );
          return JSON.stringify({
            success: false,
            message:
              'Failed to create agent - database insertion no data returned',
          });
        }

        try {
          await redisAgents.saveAgent(createdAgent);
          logger.debug(`Agent ${createdAgent.id} saved to Redis`);
        } catch (error) {
          logger.error(`Failed to save agent to Redis: ${error}`);
          // Don't throw here, Redis is a cache, PostgreSQL is the source of truth
        }

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

  if (input.mcp_servers) {
    // Convert array to Record<string, McpServerConfig>
    const mcpServersRecord: Record<string, McpServerConfig> = {};
    for (const server of input.mcp_servers) {
      const { name, env, ...serverConfig } = server;

      // Convert env array to Record<string, string>
      let envRecord: Record<string, string> | undefined;
      if (env && Array.isArray(env)) {
        envRecord = {};
        for (const envEntry of env) {
          envRecord[envEntry.name] = envEntry.value;
        }
      }

      mcpServersRecord[name] = {
        ...serverConfig,
        ...(envRecord && { env: envRecord }),
      };
    }

    partialConfig.mcp_servers = parseMcpServers(mcpServersRecord, {});
  }

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
  group: string,
  userId: string
): Promise<{ name: string; note?: string }> {
  const existingAgent = await agents.checkAgentNameExists(userId, baseName);

  if (!existingAgent) {
    return { name: baseName };
  }

  const existingName = existingAgent.name;
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
): Promise<{ id: string; created: boolean }> {
  if (providedId) {
    return { id: providedId, created: false };
  }

  const existing = await agents.getExistingPromptsForUser(userId);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const promptId = await agents.createDefaultPrompts(
    userId,
    TASK_EXECUTOR_SYSTEM_PROMPT,
    TASK_MANAGER_SYSTEM_PROMPT,
    TASK_VERIFIER_SYSTEM_PROMPT,
    TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
    false
  );

  return { id: promptId, created: true };
}
