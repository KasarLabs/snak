import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  AgentConfig,
  logger,
  validateAgent,
  validateAgentQuotas,
  AgentDatabaseInterface,
} from '@snakagent/core';

import { normalizeNumericValues } from '../utils/normalizeAgentValues.js';
import { CreateAgentSchema, CreateAgentInput } from './schemas/index.js';
import { agents } from '@snakagent/database/queries';
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
      'Create a new agent configuration with default settings. Only accepts agent profile (name, group, description, contexts). All other configuration (graph, memory, rag, mcp_servers) will use default values. To modify configuration after creation, use update_agent tool.',
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
  // Build partial config from input - only profile and prompts_id are allowed
  const partialConfig: Partial<AgentConfig.Input> = {
    profile: {
      name: input.profile.name.trim(),
      group: input.profile.group.trim(),
      description: input.profile.description.trim(),
      contexts: input.profile.contexts || [],
    },
  };

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
