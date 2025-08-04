import { SystemMessage } from '@langchain/core/messages';
import { AgentMode, ModelLevelConfig, ModelProviders } from '@snakagent/core';
import { Postgres } from '@snakagent/database';
import { SnakAgent } from '../core/snakAgent.js';
import { InteractiveAgent } from '../modes/interactive.js';
import {
  ModelSelector,
  ModelSelectorConfig,
} from '../operators/modelSelector.js';
import { logger, RpcProvider } from 'starknet';
import { AutonomousAgent } from '../modes/autonomous.js';

/**
 * Build system prompt from configuration components
 * @param promptComponents - Components to build the prompt from
 * @returns string - The built system prompt
 * @private
 */
function buildSystemPromptFromConfig(promptComponents: {
  name?: string;
  description?: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
}): string {
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
}

export interface AgentConfigSQL {
  id: string;
  name: string;
  group: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  system_prompt?: string;
  interval: number;
  plugins: string[];
  memory: {
    enabled: boolean;
    short_term_memory_size: number;
    memory_size: number;
  };
  rag: {
    enabled: boolean;
    embedding_model: string | null;
  };
  mode: AgentMode;
  max_iterations: number;
}

export interface AgentMemorySQL {
  enabled: boolean;
  short_term_memory_size: number;
  memory_size: number;
}

export interface AgentRagSQL {
  enabled: boolean;
  embedding_model: string | null;
}

function parseMemoryConfig(config: string | AgentMemorySQL): AgentMemorySQL {
  try {
    if (typeof config !== 'string') {
      return config as AgentMemorySQL;
    }
    const content = config.trim().slice(1, -1);
    const parts = content.split(',');
    return {
      enabled: parts[0] === 't' || parts[0] === 'true',
      short_term_memory_size: parseInt(parts[1], 10),
      memory_size: parseInt(parts[2] || '20', 10),
    };
  } catch (error) {
    logger.error('Error parsing memory config:', error);
    throw error;
  }
}

/**
 * Parse rag configuration from composite type string
 * @param config - Raw rag config string e.g. "(false,my-model)"
 * @returns Parsed AgentRagSQL
 * @private
 */
function parseRagConfig(config: string | AgentRagSQL): AgentRagSQL {
  try {
    if (typeof config !== 'string') {
      return config as AgentRagSQL;
    }
    const content = config.trim().slice(1, -1);
    const parts = content.split(',');
    const embedding = parts[1]?.replace(/^"|"$/g, '') || null;
    return {
      enabled: parts[0] === 't' || parts[0] === 'true',
      embedding_model:
        embedding === '' || embedding?.toLowerCase() === 'null'
          ? null
          : embedding,
    };
  } catch (error) {
    logger.error('Error parsing rag config:', error);
    throw error;
  }
}

export const studio_graph_interactive = async () => {
  await Postgres.connect({
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    database: process.env.POSTGRES_DB as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT!) as number,
  });

  const id: string = '2568a969-cd0a-43ee-8ae9-c9f2e26d0f8e';
  const q = new Postgres.Query('SELECT * from agents WHERE id = $1', [id]);
  const q_res = await Postgres.query<AgentConfigSQL>(q);
  const agent_config = {
    ...q_res[0],
    memory: parseMemoryConfig(q_res[0].memory),
    rag: parseRagConfig(q_res[0].rag),
  };

  const system_prompt = buildSystemPromptFromConfig({
    name: agent_config.name,
    description: agent_config.description,
    lore: agent_config.lore,
    objectives: agent_config.objectives,
    knowledge: agent_config.knowledge,
  });

  const system = new SystemMessage(system_prompt);
  const fast: ModelLevelConfig = {
    provider: ModelProviders.OpenAI,
    model_name: 'gpt-4o-mini',
    description: 'Optimized for speed and simple tasks.',
  };
  const smart: ModelLevelConfig = {
    provider: ModelProviders.OpenAI,
    model_name: 'gpt-4o-mini',
    description: 'Optimized for complex reasoning.',
  };
  const cheap: ModelLevelConfig = {
    provider: ModelProviders.OpenAI,
    model_name: 'gpt-4o-mini',
    description: 'Good cost-performance balance.',
  };

  const model_selector: ModelSelectorConfig = {
    debugMode: false,
    useModelSelector: true,
    modelsConfig: {
      fast,
      cheap,
      smart,
    },
  };
  const agent = new SnakAgent({
    provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
    accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
    accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
    db_credentials: {
      host: process.env.POSTGRES_HOST as string,
      user: process.env.POSTGRES_USER as string,
      database: process.env.POSTGRES_DB as string,
      password: process.env.POSTGRES_PASSWORD as string,
      port: parseInt(process.env.POSTGRES_PORT!) as number,
    },
    agentConfig: {
      id: agent_config.id,
      name: agent_config.name,
      group: agent_config.group,
      description: agent_config.description,
      prompt: system,
      interval: agent_config.interval,
      maxIterations: agent_config.max_iterations,
      mode: agent_config.mode,
      chatId: 'test',
      memory: agent_config.memory,
      rag: agent_config.rag,
      plugins: agent_config.plugins,
      mcpServers: {},
    },
    modelSelectorConfig: model_selector,
    memory: agent_config.memory,
  });

  const model_selector_instance = new ModelSelector(model_selector);
  await model_selector_instance.init();
  await agent.init();
  const interactive_agent = new InteractiveAgent(
    agent,
    model_selector_instance
  );
  const graph = (await interactive_agent.initialize()).app;
  return graph;
};


export const studio_graph_autonomous = async () => {
  await Postgres.connect({
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    database: process.env.POSTGRES_DB as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT!) as number,
  });

  const id: string = '2568a969-cd0a-43ee-8ae9-c9f2e26d0f8e';
  const q = new Postgres.Query('SELECT * from agents WHERE id = $1', [id]);
  const q_res = await Postgres.query<AgentConfigSQL>(q);
  const agent_config = {
    ...q_res[0],
    memory: parseMemoryConfig(q_res[0].memory),
    rag: parseRagConfig(q_res[0].rag),
  };

  const system_prompt = buildSystemPromptFromConfig({
    name: agent_config.name,
    description: agent_config.description,
    lore: agent_config.lore,
    objectives: agent_config.objectives,
    knowledge: agent_config.knowledge,
  });

  const system = new SystemMessage(system_prompt);
  const fast: ModelLevelConfig = {
    provider: ModelProviders.OpenAI,
    model_name: 'gpt-4o-mini',
    description: 'Optimized for speed and simple tasks.',
  };
  const smart: ModelLevelConfig = {
    provider: ModelProviders.OpenAI,
    model_name: 'gpt-4o-mini',
    description: 'Optimized for complex reasoning.',
  };
  const cheap: ModelLevelConfig = {
    provider: ModelProviders.OpenAI,
    model_name: 'gpt-4o-mini',
    description: 'Good cost-performance balance.',
  };

  const model_selector: ModelSelectorConfig = {
    debugMode: false,
    useModelSelector: true,
    modelsConfig: {
      fast,
      cheap,
      smart,
    },
  };
  const agent = new SnakAgent({
    provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
    accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
    accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
    db_credentials: {
      host: process.env.POSTGRES_HOST as string,
      user: process.env.POSTGRES_USER as string,
      database: process.env.POSTGRES_DB as string,
      password: process.env.POSTGRES_PASSWORD as string,
      port: parseInt(process.env.POSTGRES_PORT!) as number,
    },
    agentConfig: {
      id: agent_config.id,
      name: agent_config.name,
      group: agent_config.group,
      description: agent_config.description,
      prompt: system,
      interval: agent_config.interval,
      maxIterations: agent_config.max_iterations,
      mode: agent_config.mode,
      chatId: 'test',
      memory: agent_config.memory,
      rag: agent_config.rag,
      plugins: agent_config.plugins,
      mcpServers: {},
    },
    modelSelectorConfig: model_selector,
    memory: agent_config.memory,
  });

  const model_selector_instance = new ModelSelector(model_selector);
  await model_selector_instance.init();
  await agent.init();
  const autonomous_agent = new AutonomousAgent(
    agent,
    model_selector_instance
  );
  const graph = (await autonomous_agent.initialize()).app;
  return graph;
};
