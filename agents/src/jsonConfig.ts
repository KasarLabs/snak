import { SystemMessage } from '@langchain/core/messages';
import { createBox, getTerminalWidth } from './formatting.js';
import chalk from 'chalk';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..', '..');

/**
 * Interface for a token object
 */
export interface Token {
  symbol: string;
  amount: number;
}

/**
 * Interface for the JSON configuration object
 */
export interface JsonConfig {
  name: string;
  prompt: SystemMessage;
  interval: number;
  chat_id: string;
  plugins: string[];
  autonomous?: boolean;
  memory: boolean;
  mcpServers?: Record<string, any>;
}

/**
 * Interface for a single model configuration entry
 */
export interface ModelLevelConfig {
  provider: string;
  model_name: string;
  description?: string;
}

/**
 * Interface for the entire models configuration object
 */
export interface ModelsConfig {
  models: {
    fast: ModelLevelConfig;
    smart: ModelLevelConfig;
    cheap: ModelLevelConfig;
    [key: string]: ModelLevelConfig; // Allow for other potential levels
  };
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

  if (json.autonomous) {
    identityParts.push(`Mode: Autonomous`);
  }

  // Knowledge Section
  if (Array.isArray(json.knowledge)) {
    contextParts.push(`Your knowledge : [${json.knowledge.join(']\n[')}]`);
  }

  return contextParts.join('\n');
};

/**
 * Validates the JSON configuration object
 */
export const validateConfig = (config: JsonConfig) => {
  const requiredFields = [
    'name',
    'interval',
    'chat_id',
    'plugins',
    'prompt',
  ] as const;

  for (const field of requiredFields) {
    if (!config[field as keyof JsonConfig]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!(config.prompt instanceof SystemMessage)) {
    throw new Error('prompt must be an instance of SystemMessage');
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
): Promise<JsonConfig | undefined> => {
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

    // Create config object
    const jsonconfig: JsonConfig = {
      prompt: systemMessagefromjson,
      name: json.name,
      interval: json.interval,
      chat_id: json.chat_id,
      autonomous: json.autonomous || false,
      plugins: Array.isArray(json.plugins)
        ? json.plugins.map((tool: string) => tool.toLowerCase())
        : [],
      memory: json.memory || false,
      mcpServers: json.mcpServers || {},
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
): Promise<JsonConfig | undefined> => {
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

/**
 * Loads the JSON models configuration object
 */
export const loadModelsConfig = async (
  configFileName: string = 'default.models.json'
): Promise<ModelsConfig | undefined> => {
  // Use workspaceRoot calculated at the top of the file
  const configPath = path.resolve(
    workspaceRoot,
    'config',
    'models',
    configFileName
  );
  logger.debug(`Attempting to load models config from: ${configPath}`);

  try {
    await fs.access(configPath);
    const jsonData = await fs.readFile(configPath, 'utf8');
    const config: ModelsConfig = JSON.parse(jsonData);

    // Basic validation
    if (
      !config.models ||
      !config.models.fast ||
      !config.models.smart ||
      !config.models.cheap
    ) {
      throw new Error(
        'Invalid models config structure. Must include fast, smart, and cheap models.'
      );
    }
    if (
      !config.models.fast.provider ||
      !config.models.fast.model_name ||
      !config.models.smart.provider ||
      !config.models.smart.model_name ||
      !config.models.cheap.provider ||
      !config.models.cheap.model_name
    ) {
      throw new Error(
        'Each model level must specify a provider and model_name.'
      );
    }

    logger.info(`Successfully loaded models config from ${configPath}`);
    return config;
  } catch (error) {
    logger.error(
      `Failed to load or parse models config from ${configPath}: ${error.message}`
    );
    return undefined;
  }
};
