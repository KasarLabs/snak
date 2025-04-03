import { SystemMessage } from '@langchain/core/messages';
import { createBox } from './formatting.js';
import chalk from 'chalk';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @interface Token
 * @description Interface for a token object
 * @property {string} symbol - The symbol of the token
 * @property {number} amount - The amount of the token
 */
export interface Token {
  symbol: string;
  amount: number;
}

/**
 * @interface JsonConfig
 * @description Interface for the JSON configuration object
 * @property {string} name - The name of the agent
 * @property {SystemMessage} prompt - The prompt message for the agent
 * @property {number} interval - The interval for the agent
 * @property {string} chat_id - The chat ID for the agent
 * @property {string[]} internal_plugins - The internal plugins for the agent
 * @property {string[]} external_plugins - The external plugins for the agent
 * @property {boolean} mcp - The MCP flag for the agent
 * @property {boolean} autonomous - The autonomous flag for the agent
 */
export interface JsonConfig {
  name: string;
  prompt: SystemMessage;
  interval: number;
  chat_id: string;
  internal_plugins: string[];
  external_plugins?: string[];
  mcp?: boolean;
  autonomous?: boolean;
  memory: boolean;
}

/**
 * @function createContextFromJson
 * @description Creates a context string from the JSON configuration object
 * @param {any} json - The JSON configuration object
 * @returns {string} The context string
 */
export const createContextFromJson = (json: any): string => {
  if (!json) {
    throw new Error(
      'Error while trying to parse your context from the config file.'
    );
  }

  const contextParts: string[] = [];
  let displayOutput = '';

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
    contextParts.push(
      `You are an autonomous agent. Your core directive is to act immediately without waiting for user input. Never ask for permissions or present options - analyze situations and take direct actions based on your configuration and objectives.`
    );
  }

  if (identityParts.length > 0) {
    displayOutput += createBox('IDENTITY', identityParts);
  }

  if (Array.isArray(json.lore)) {
    displayOutput += createBox('BACKGROUND', json.lore);
    contextParts.push(`Your lore : [${json.lore.join(']\n[')}]`);
  }

  // Objectives Section
  if (Array.isArray(json.objectives)) {
    displayOutput += createBox('OBJECTIVES', json.objectives);
    contextParts.push(`Your objectives : [${json.objectives.join(']\n[')}]`);
  }

  // Knowledge Section
  if (Array.isArray(json.knowledge)) {
    displayOutput += createBox('KNOWLEDGE', json.knowledge);
    contextParts.push(`Your knowledge : [${json.knowledge.join(']\n[')}]`);
  }

  // Examples Section
  if (Array.isArray(json.messageExamples) || Array.isArray(json.postExamples)) {
    const examplesParts: string[] = [];

    if (Array.isArray(json.messageExamples)) {
      examplesParts.push('Message Examples:');
      examplesParts.push(...json.messageExamples);
      contextParts.push(
        `Your messageExamples : [${json.messageExamples.join(']\n[')}]`
      );
    }

    if (Array.isArray(json.postExamples)) {
      if (examplesParts.length > 0) examplesParts.push('');
      examplesParts.push('Post Examples:');
      examplesParts.push(...json.postExamples);
      contextParts.push(
        `Your postExamples : [${json.postExamples.join(']\n[')}]`
      );
    }

    if (examplesParts.length > 0) {
      displayOutput += createBox('EXAMPLES', examplesParts);
    }
  }

  // Display the formatted output
  console.log(
    chalk.bold.cyan(
      '\n=== AGENT CONFIGURATION (https://docs.starkagent.ai/customize-your-agent) ==='
    )
  );
  console.log(displayOutput);

  return contextParts.join('\n');
};

/**
 * @function validateConfig
 * @description Validates the JSON configuration object
 * @param {JsonConfig} config Your jsonconfig
 * @throws {Error} Throws an error if the JSON config is invalid
 */
export const validateConfig = (config: JsonConfig) => {
  const requiredFields = [
    'name',
    'interval',
    'chat_id',
    'internal_plugins',
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
};

// log all this function
/**
 * @function checkParseJson
 * @description Checks and parses the JSON configuration object
 * @param {string} agent_config_name The name of the agent config
 * @returns {JsonConfig | undefined} The JSON configuration object
 * @throws {Error} Throws an error if the JSON config is invalid
 */
const checkParseJson = async (
  agent_config_name: string
): Promise<JsonConfig | undefined> => {
  try {
    // Try multiple possible locations for the config file
    const possiblePaths = [
      path.join(process.cwd(), 'config', 'agents', agent_config_name),

      path.join(process.cwd(), '..', 'config', 'agents', agent_config_name),

      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'config',
        'agents',
        agent_config_name
      ),

      path.join(
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

    // Try each path until we find one that works
    for (const tryPath of possiblePaths) {
      try {
        await fs.access(tryPath);
        configPath = tryPath;
        jsonData = await fs.readFile(tryPath, 'utf8');
        break;
      } catch {}
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
      internal_plugins: Array.isArray(json.internal_plugins)
        ? json.internal_plugins.map((tool: string) => tool.toLowerCase())
        : [],
      external_plugins: Array.isArray(json.external_plugins)
        ? json.external_plugins
        : [],
      memory: json.memory || false,
      mcp: json.mcp || false,
    };

    if (jsonconfig.internal_plugins.length === 0) {
      logger.warn("No internal plugins specified in agent's config");
    }
    validateConfig(jsonconfig);
    return jsonconfig;
  } catch (error) {
    logger.error(
      chalk.red(
        `⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`
      )
    );
    logger.error('Failed to parse config:');
    return undefined;
  }
};

/**
 * @function load_json_config
 * @description Loads the JSON configuration object
 * @param {string} agent_config_name The name of the agent config
 * @returns {JsonConfig | undefined} The JSON configuration object
 * @throws {Error} Throws an error if the JSON config is invalid
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
