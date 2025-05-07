import { SystemMessage } from '@langchain/core/messages';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { logger } from '@snakagent/core';
import { MemoryConfig } from '../agents/operators/memoryAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Interface for a token object
 */
export interface Token {
  symbol: string;
  amount: number;
}

/**
 * Enum for the mode of operation of the agent
 */
export enum AgentMode {
  INTERACTIVE = 'interactive',
  AUTONOMOUS = 'autonomous',
  HYBRID = 'hybrid',
}

/**
 * Maps mode values to their string representations
 */
export const AGENT_MODES = {
  [AgentMode.AUTONOMOUS]: 'autonomous',
  [AgentMode.HYBRID]: 'hybrid',
  [AgentMode.INTERACTIVE]: 'interactive',
};

/**
 * Interface for the JSON configuration object
 */
export interface AgentConfig {
  name: string;
  prompt: SystemMessage;
  interval: number;
  chat_id: string;
  plugins: string[];
  memory: MemoryConfig;
  mcpServers?: Record<string, any>;
  mode: AgentMode;
  maxIteration: number;
}

/**
 * Creates a context string from the JSON configuration object
 */
export const createContextFromJson = (json: any): string => {
  if (!json) {
    throw new Error(
      'Error while trying to parse your context from the config file.'
    );
  }

  const contextParts: string[] = [];

  // Objectives Section
  if (Array.isArray(json.objectives)) {
    contextParts.push(`Your objectives : [${json.objectives.join(']\n[')}]`);
  }

  // Identity Section
  const identityParts: string[] = [];
  if (json.name) {
    identityParts.push(`Name: ${json.name}`);
    contextParts.push(`Your name : [${json.name}]`);
  }
  if (json.bio) {
    identityParts.push(`Bio: ${json.bio}`);
    contextParts.push(`Your Bio : [${json.bio}]`);
  }

  // Check for autonomous mode
  if (json.mode) {
    const mode = parseAgentMode(json.mode);
    if (mode === AgentMode.AUTONOMOUS || mode === AgentMode.HYBRID) {
      identityParts.push(`Mode: ${mode}`);
    }
  }

  // Knowledge Section
  if (Array.isArray(json.knowledge)) {
    contextParts.push(`Your knowledge : [${json.knowledge.join(']\n[')}]`);
  }

  return contextParts.join('\n');
};

/**
 * Helper function to parse agent mode from various formats
 */
export const parseAgentMode = (modeConfig: any): AgentMode => {
  // Handle case where modeConfig is a string
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

  // Handle case where modeConfig is an object with mode property
  if (modeConfig && typeof modeConfig === 'object') {
    // New format
    if (modeConfig.mode && typeof modeConfig.mode === 'string') {
      const mode = modeConfig.mode.toLowerCase();
      if (Object.values(AgentMode).includes(mode as AgentMode)) {
        return mode as AgentMode;
      }
    }

    // Legacy format with boolean flags
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

  // Default case
  logger.warn(
    `Could not determine agent mode - defaulting to "${AgentMode.INTERACTIVE}"`
  );
  return AgentMode.INTERACTIVE;
};

/**
 * Validates the JSON configuration object
 */
export const validateConfig = (config: AgentConfig) => {
  const requiredFields = [
    'name',
    'interval',
    'chat_id',
    'plugins',
    'prompt',
    'mode',
    'maxIteration',
  ] as const;

  for (const field of requiredFields) {
    if (!config[field as keyof AgentConfig]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!(config.prompt instanceof SystemMessage)) {
    throw new Error('prompt must be an instance of SystemMessage');
  }

  // Validate mode configuration
  if (!Object.values(AgentMode).includes(config.mode)) {
    throw new Error(
      `Invalid mode "${config.mode}" specified in configuration. Must be one of: ${Object.values(AgentMode).join(', ')}`
    );
  }

  // Ensure recursion limit is valid
  if (typeof config.maxIteration !== 'number' || config.maxIteration < 0) {
    throw new Error(
      'maxIteration must be a positive number in mode configuration'
    );
  }

  // Validate mcpServers if present
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
};

/**
 * Checks and parses the JSON configuration object
 */
const checkParseJson = async (
  agent_config_name: string
): Promise<AgentConfig | undefined> => {
  try {
    // Try multiple possible locations for the config file
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

    // Find first accessible config file
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

    // Create system message
    const systemMessagefromjson = new SystemMessage(
      createContextFromJson(json)
    );

    // Handle mode configuration
    if (!json.mode) {
      throw new Error(
        'Mode configuration is mandatory but missing in config file'
      );
    }

    // Create config object
    const jsonconfig: AgentConfig = {
      prompt: systemMessagefromjson,
      name: json.name,
      interval: json.interval,
      chat_id: json.chat_id,
      mode: parseAgentMode(json.mode),
      plugins: Array.isArray(json.plugins)
        ? json.plugins.map((tool: string) => tool.toLowerCase())
        : [],
      memory: json.memory || false,
      mcpServers: json.mcpServers || {},
      maxIteration:
        typeof json.maxIteration === 'number'
          ? json.maxIteration
          : json.mode &&
              typeof json.mode === 'object' &&
              typeof json.mode.maxIteration === 'number'
            ? json.mode.maxIteration
            : 10,
    };

    if (jsonconfig.plugins.length === 0) {
      logger.warn("No plugins specified in agent's config");
    }
    validateConfig(jsonconfig);
    return jsonconfig;
  } catch (error) {
    logger.error(
      chalk.red(
        `⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`
      )
    );
    logger.error('Failed to parse config : ', error);
    return undefined;
  }
};

/**
 * Loads the JSON configuration object
 */
export const load_json_config = async (
  agent_config_name: string
): Promise<AgentConfig | undefined> => {
  try {
    const json = await checkParseJson(agent_config_name);
    if (!json) {
      throw new Error('Failed to load JSON config');
    }
    return json;
  } catch (error) {
    logger.error(error);
    return undefined;
  }
};
