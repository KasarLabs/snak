import { SystemMessage } from '@langchain/core/messages';
import { createBox, formatSection } from './formatting.js';
import chalk from 'chalk';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Token {
  symbol: string;
  amount: number;
}

export interface Transfer_limit {
  token: Token[];
}

export interface JsonConfig {
  name: string;
  prompt: SystemMessage;
  interval: number;
  chat_id: string;
  internal_plugins: string[];
  external_plugins?: string[];
  autonomous?: boolean;
}

const createContextFromJson = (json: any): string => {
  if (!json) {
    throw new Error(
      'Error while trying to parse your context from the youragent.json'
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
    displayOutput += createBox('IDENTITY', formatSection(identityParts));
  }

  if (Array.isArray(json.lore)) {
    displayOutput += createBox('BACKGROUND', formatSection(json.lore));
    contextParts.push(`Your lore : [${json.lore.join(']\n[')}]`);
  }

  // Objectives Section
  if (Array.isArray(json.objectives)) {
    displayOutput += createBox('OBJECTIVES', formatSection(json.objectives));
    contextParts.push(`Your objectives : [${json.objectives.join(']\n[')}]`);
  }

  // Knowledge Section
  if (Array.isArray(json.knowledge)) {
    displayOutput += createBox('KNOWLEDGE', formatSection(json.knowledge));
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
      displayOutput += createBox('EXAMPLES', formatSection(examplesParts));
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
const checkParseJson = async (
  agent_config_name: string
): Promise<JsonConfig | undefined> => {
  try {
    const projectRoot = path.resolve(__dirname, '../../..');
    const configPath = path.join(
      projectRoot,
      'config',
      'agents',
      agent_config_name
    );
    console.log('Loading config from:', configPath);

    // Use fs instead of import
    const fs = await import('fs/promises');
    const jsonData = await fs.readFile(configPath, 'utf8');
    console.log('Read config file successfully');

    // Parse JSON
    const json = JSON.parse(jsonData);
    console.log('Parsed JSON with properties:', Object.keys(json));

    if (!json) {
      throw new Error(`Can't access to config file: ${configPath}`);
    }

    // Create system message
    const systemMessagefromjson = new SystemMessage(
      createContextFromJson(json)
    );

    // Create config object
    let jsonconfig: JsonConfig = {
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
    };

    // Log the created config
    console.log('Created jsonconfig with properties:', Object.keys(jsonconfig));

    validateConfig(jsonconfig);
    console.log('Config validation passed');
    return jsonconfig;
  } catch (error) {
    console.error(
      chalk.red(
        `⚠️ Ensure your environment variables are set correctly according to your config/agent.json file.`
      )
    );
    console.error(chalk.red('Failed to parse config:'), error);
    return undefined;
  }
};

export const load_json_config = async (
  agent_config_name: string
): Promise<JsonConfig> => {
  const json = await checkParseJson(agent_config_name);
  if (!json) {
    throw new Error('Failed to load JSON config');
  }
  return json;
};
