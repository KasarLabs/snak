import { SystemMessage } from '@langchain/core/messages';
import { createBox, getTerminalWidth } from '../prompt/formatting.js';
import chalk from 'chalk';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { logger } from '@snakagent/core';

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
 * Interface for the JSON configuration object
 */
export interface JsonConfig {
  name: string;
  prompt: SystemMessage;
  interval: number;
  chat_id: string;
  plugins: string[];
  memory: boolean;
  mcpServers?: Record<string, any>;
  mode: ModeConfig;
}

/**
 * Type for the mode of operation of the agent
 */
export interface ModeConfig {
  interactive: boolean;
  autonomous: boolean;
  recursionLimit: number;
  metaSelection?: boolean;
}

/**
 * Updates the mode configuration in the JSON file
 */
export const updateModeConfig = async (
  configPath: string,
  mode: 'interactive' | 'autonomous'
): Promise<boolean> => {
  try {
    // Read the current JSON file
    const jsonData = await fs.readFile(configPath, 'utf8');
    const json = JSON.parse(jsonData);

    // Ensure the mode object exists
    if (!json.mode) {
      json.mode = {
        recursionLimit: 15,
      };
    }

    // Update the mode properties
    if (mode === 'interactive') {
      json.mode.interactive = true;
      json.mode.autonomous = false;
    } else if (mode === 'autonomous') {
      json.mode.interactive = false;
      json.mode.autonomous = true;
    }

    // Write the updated JSON back to the file
    await fs.writeFile(configPath, JSON.stringify(json, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error('Failed to update mode configuration: ', error);
    return false;
  }
};

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
  if (json.mode && json.mode.autonomous) {
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
    'mode',
  ] as const;

  for (const field of requiredFields) {
    if (!config[field as keyof JsonConfig]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (!(config.prompt instanceof SystemMessage)) {
    throw new Error('prompt must be an instance of SystemMessage');
  }

  // Validate mode configuration
  // Log a warning if both modes are enabled but don't change the configuration
  // This allows the runtime code to control which mode is active
  if (config.mode.interactive && config.mode.autonomous) {
    logger.warn(
      'Both interactive and autonomous modes are enabled in configuration'
    );
  }

  // Ensure recursion limit is valid
  if (
    typeof config.mode.recursionLimit !== 'number' ||
    config.mode.recursionLimit < 0
  ) {
    config.mode.recursionLimit = 15;
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

    // Handle mode configuration
    let modeConfig: ModeConfig;

    if (json.mode) {
      // Use existing mode configuration
      modeConfig = {
        interactive: json.mode.interactive !== false, // default to true if not specified
        autonomous: json.mode.autonomous === true, // default to false if not specified
        recursionLimit:
          typeof json.mode.recursionLimit === 'number'
            ? json.mode.recursionLimit
            : 15, // default to 15 if not specified
      };
    } else {
      // Default mode configuration
      modeConfig = {
        interactive: true,
        autonomous: false,
        recursionLimit: 15,
      };
    }

    // Ensure only one mode is enabled
    if (modeConfig.interactive && modeConfig.autonomous) {
      logger.warn(
        'Both interactive and autonomous modes are enabled - setting interactive to true and autonomous to false'
      );
      modeConfig.interactive = true;
      modeConfig.autonomous = false;
    }

    // Create config object
    const jsonconfig: JsonConfig = {
      prompt: systemMessagefromjson,
      name: json.name,
      interval: json.interval,
      chat_id: json.chat_id,
      mode: modeConfig,
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
