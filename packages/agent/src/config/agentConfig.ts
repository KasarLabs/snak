import { SystemMessage } from '@langchain/core/messages';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger, AgentConfig, RawAgentConfig } from '@snakagent/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Token interface representing a cryptocurrency token with symbol and amount
 */
export interface Token {
  symbol: string;
  amount: number;
}

/**
 * Agent operation modes
 */
export enum AgentMode {
  INTERACTIVE = 'interactive',
  AUTONOMOUS = 'autonomous',
  HYBRID = 'hybrid',
}

/**
 * Maps mode enum values to their string representations
 */
export const AGENT_MODES = {
  [AgentMode.AUTONOMOUS]: 'autonomous',
  [AgentMode.HYBRID]: 'hybrid',
  [AgentMode.INTERACTIVE]: 'interactive',
};

/**
 * Creates a context string from the JSON configuration object
 * @param json - Raw agent configuration object
 * @returns Formatted context string for the agent
 * @throws Error if json is null or undefined
 */
export const createContextFromJson = (json: RawAgentConfig): string => {
  if (!json) {
    throw new Error(
      'Error while trying to parse your context from the config file.'
    );
  }

  const contextParts: string[] = [];

  if (json.name) {
    contextParts.push(`Your name : [${json.name}]`);
  }
  if (json.description) {
    contextParts.push(`Your Description : [${json.description}]`);
  }

  if (Array.isArray(json.lore)) {
    contextParts.push(`Your lore : [${json.lore.join(']\n[')}]`);
  }

  if (Array.isArray(json.objectives)) {
    contextParts.push(`Your objectives : [${json.objectives.join(']\n[')}]`);
  }

  if (Array.isArray(json.knowledge)) {
    contextParts.push(`Your knowledge : [${json.knowledge.join(']\n[')}]`);
  }

  return contextParts.join('\n');
};

/**
 * Builds a system prompt from agent prompt components
 * @param promptComponents - Object containing agent prompt components
 * @returns Formatted system prompt string
 */
export const buildSystemPrompt = (promptComponents: {
  name?: string;
  description?: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  mode?: AgentMode;
}): string => {
  const contextParts: string[] = [];

  if (promptComponents.name) {
    contextParts.push(`Your name : [${promptComponents.name}]`);
  }
  if (promptComponents.description) {
    contextParts.push(`Your Description : [${promptComponents.description}]`);
  }

  if (
    Array.isArray(promptComponents.lore) &&
    promptComponents.lore.length > 0
  ) {
    contextParts.push(`Your lore : [${promptComponents.lore.join(']\n[')}]`);
  }

  if (
    Array.isArray(promptComponents.objectives) &&
    promptComponents.objectives.length > 0
  ) {
    contextParts.push(
      `Your objectives : [${promptComponents.objectives.join(']\n[')}]`
    );
  }

  if (
    Array.isArray(promptComponents.knowledge) &&
    promptComponents.knowledge.length > 0
  ) {
    contextParts.push(
      `Your knowledge : [${promptComponents.knowledge.join(']\n[')}]`
    );
  }

  return contextParts.join('\n');
};

/**
 * Creates a deep copy of an agent configuration
 * @param config - Agent configuration to copy
 * @returns Deep copy of the agent configuration
 * @throws Error if config is null or undefined
 */
export const deepCopyAgentConfig = (config: AgentConfig): AgentConfig => {
  if (!config) {
    throw new Error('Cannot copy null or undefined config');
  }

  const promptCopy = new SystemMessage(config.prompt.content as string);

  const mcpServersCopy = config.mcpServers
    ? JSON.parse(JSON.stringify(config.mcpServers))
    : undefined;

  const memoryCopy = config.memory
    ? JSON.parse(JSON.stringify(config.memory))
    : config.memory;

  const ragCopy = config.rag
    ? JSON.parse(JSON.stringify(config.rag))
    : config.rag;

  const configCopy: AgentConfig = {
    id: config.id,
    group: config.group,
    name: config.name,
    description: config.description,
    prompt: promptCopy,
    interval: config.interval,
    chatId: config.chatId,
    plugins: [...config.plugins],
    memory: memoryCopy,
    rag: ragCopy,
    mcpServers: mcpServersCopy,
    mode: config.mode,
    maxIterations: config.maxIterations,
  };

  return configCopy;
};

export const normalizeMemoryAndRag = (memory: any, rag: any) => {
  const normalizedMemory = typeof memory === 'object' && memory !== null ? memory : { enabled: false };
  const normalizedRag = typeof rag === 'object' && rag !== null ? rag : { enabled: false };
  
  return { memory: normalizedMemory, rag: normalizedRag };
};

/**
 * Parses agent mode from various input formats
 * @param modeConfig - Mode configuration (string or object)
 * @returns Parsed AgentMode enum value
 */
export const parseAgentMode = (modeConfig: any): AgentMode => {
  if (typeof modeConfig === 'string') {
    const mode = modeConfig.toLowerCase();
    if (Object.values(AgentMode).includes(mode as AgentMode)) {
      return mode as AgentMode;
    }
    logger.warn(
      `Invalid mode string "${mode}" - defaulting to "${AgentMode.INTERACTIVE}"`
    );
    return AgentMode.INTERACTIVE;
  }

  if (modeConfig && typeof modeConfig === 'object') {
    if (modeConfig.mode && typeof modeConfig.mode === 'string') {
      const mode = modeConfig.mode.toLowerCase();
      if (Object.values(AgentMode).includes(mode as AgentMode)) {
        return mode as AgentMode;
      }
    }

    if (
      'interactive' in modeConfig ||
      'autonomous' in modeConfig ||
      'hybrid' in modeConfig
    ) {
      if (modeConfig.hybrid === true) {
        return AgentMode.HYBRID;
      } else if (modeConfig.autonomous === true) {
        return AgentMode.AUTONOMOUS;
      } else {
        return AgentMode.INTERACTIVE;
      }
    }
  }

  logger.warn(
    `Could not determine agent mode - defaulting to "${AgentMode.INTERACTIVE}"`
  );
  return AgentMode.INTERACTIVE;
};

/**
 * Validates the agent configuration object
 * @param config - Agent configuration to validate
 * @throws Error if configuration is invalid
 */
export const validateConfig = (config: AgentConfig) => {
  const requiredFields = [
    'name',
    'interval',
    'plugins',
    'prompt',
    'mode',
    'maxIterations',
  ] as const;

  for (const field of requiredFields) {
    if (config[field as keyof AgentConfig] === undefined) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!(config.prompt instanceof SystemMessage)) {
    throw new Error('prompt must be an instance of SystemMessage');
  }

  if (!Object.values(AgentMode).includes(config.mode)) {
    throw new Error(
      `Invalid mode "${config.mode}" specified in configuration. Must be one of: ${Object.values(AgentMode).join(', ')}`
    );
  }

  if (typeof config.maxIterations !== 'number' || config.maxIterations < 0) {
    throw new Error(
      'maxIterations must be a positive number in mode configuration'
    );
  }

  if (config.mcpServers) {
    if (typeof config.mcpServers !== 'object') {
      throw new Error('mcpServers must be an object');
    }

    for (const [serverName, serverConfig] of Object.entries(
      config.mcpServers
    )) {
      if (!serverConfig.command || typeof serverConfig.command !== 'string') {
        throw new Error(
          `mcpServers.${serverName} must have a valid command string`
        );
      }

      if (!Array.isArray(serverConfig.args)) {
        throw new Error(`mcpServers.${serverName} must have an args array`);
      }

      if (serverConfig.env && typeof serverConfig.env !== 'object') {
        throw new Error(
          `mcpServers.${serverName} env must be an object if present`
        );
      }
    }
  }

  if (config.rag && typeof config.rag === 'object') {
    if (
      config.rag.enabled !== undefined &&
      typeof config.rag.enabled !== 'boolean'
    ) {
      throw new Error('rag.enabled must be a boolean');
    }
    if (
      config.rag.embeddingModel !== undefined &&
      typeof config.rag.embeddingModel !== 'string'
    ) {
      throw new Error('rag.embeddingModel must be a string');
    }
  }
};

/**
 * Parses and validates the JSON configuration file
 * @param agent_config_name - Name of the agent configuration file
 * @returns Parsed and validated agent configuration
 * @throws Error if file cannot be found or parsed
 */
const checkParseJson = async (
  agent_config_name: string
): Promise<AgentConfig> => {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), 'config', 'agents', agent_config_name),
      path.resolve(process.cwd(), '..', 'config', 'agents', agent_config_name),
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'config',
        'agents',
        agent_config_name
      ),
      path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'config',
        'agents',
        agent_config_name
      ),
    ];

    let configPath: string | null = null;
    let jsonData: string | null = null;

    for (const tryPath of possiblePaths) {
      try {
        await fs.access(tryPath);
        configPath = tryPath;
        jsonData = await fs.readFile(tryPath, 'utf8');
        break;
      } catch (error) {
        logger.debug(
          `Failed to access config file at ${tryPath}: ${error.message}`
        );
      }
    }

    if (!configPath || !jsonData) {
      throw new Error(
        `Could not find config file '${agent_config_name}' in any of the expected locations`
      );
    }

    const json = JSON.parse(jsonData);
    if (!json) {
      throw new Error(`Failed to parse JSON from ${configPath}`);
    }

    const systemMessagefromjson = new SystemMessage(
      createContextFromJson(json)
    );

    if (!json.mode) {
      throw new Error(
        'Mode configuration is mandatory but missing in config file'
      );
    }

    const { memory, rag } = normalizeMemoryAndRag(json.memory || false, json.rag || false);
    
    const agentConfig: AgentConfig = {
      id: uuidv4(),
      name: json.name,
      group: json.group,
      description: json.description,
      interval: json.interval,
      chatId: json.chatId,
      mode: parseAgentMode(json.mode),
      plugins: Array.isArray(json.plugins)
        ? json.plugins.map((tool: string) => tool.toLowerCase())
        : [],
      memory,
      rag,
      mcpServers: json.mcpServers || {},
      maxIterations:
        typeof json.maxIterations === 'number'
          ? json.maxIterations
          : json.mode &&
              typeof json.mode === 'object' &&
              typeof json.mode.maxIterations === 'number'
            ? json.mode.maxIterations
            : 10,
      prompt: systemMessagefromjson,
    };

    if (agentConfig.plugins.length === 0) {
      logger.warn("No plugins specified in agent's config");
    }
    validateConfig(agentConfig);
    return agentConfig;
  } catch (error) {
    logger.error(
      chalk.red(
        `⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`
      )
    );
    logger.error('Failed to parse config : ', error);
    throw error;
  }
};

/**
 * Loads and parses the JSON configuration file
 * @param agent_config_name - Name of the agent configuration file
 * @returns Parsed agent configuration
 * @throws Error if configuration cannot be loaded
 */
export const load_json_config = async (
  agent_config_name: string
): Promise<AgentConfig> => {
  try {
    const json = await checkParseJson(agent_config_name);
    return json;
  } catch (error) {
    logger.error(error);
    throw new Error('Failed to load JSON config');
  }
};
