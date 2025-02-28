import { SystemMessage } from '@langchain/core/messages';
import { createBox, formatSection } from './formatting';
import chalk from 'chalk';
import * as path from 'path';
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

const checkParseJson = (agent_config_name: string): JsonConfig | undefined => {
  try {
    const json = require(path.resolve(`../config/agents/${agent_config_name}`));
    if (!json) {
      throw new Error(`Can't access to ./config/agents/config-agent.json`);
    }

    const systemMessagefromjson = new SystemMessage(
      createContextFromJson(json)
    );

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

    validateConfig(jsonconfig);
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

export const load_json_config = (
  agent_config_name: string
): JsonConfig | undefined => {
  const json = checkParseJson(agent_config_name);
  if (!json) {
    return undefined;
  }
  return json;
};
