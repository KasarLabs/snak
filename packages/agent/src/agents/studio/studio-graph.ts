import { SystemMessage } from '@langchain/core/messages';
import {
  AgentConfig,
  AgentMode,
  ModelConfig,
  ModelProviders,
  validateAgent,
} from '@snakagent/core';
import { Postgres } from '@snakagent/database';
import { SnakAgent } from '../core/snakAgent.js';
import {
  ModelSelector,
  ModelSelectorConfig,
} from '../operators/modelSelector.js';
import { logger, RpcProvider } from 'starknet';
import { Graph } from '@agents/graphs/graph.js';

// Types and Interfaces
export interface AgentConfigSQL {
  id: string;
  user_id: string;
  name: string;
  group: string;
  description: string;
  contexts: string[];
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

// Helper Functions
function buildSystemPromptFromConfig(promptComponents: {
  name?: string;
  description?: string;
  contexts: string[];
}): string {
  const contextParts: string[] = [];

  if (promptComponents.name) {
    contextParts.push(`Your name : [${promptComponents.name}]`);
  }
  if (promptComponents.description) {
    contextParts.push(`Your Description : [${promptComponents.description}]`);
  }

  if (
    Array.isArray(promptComponents.contexts) &&
    promptComponents.contexts.length > 0
  ) {
    contextParts.push(
      `Your contexts : [${promptComponents.contexts.join(']\n[')}]`
    );
  }

  return contextParts.join('\n');
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

// Database Connection
async function ensureDbConnection(): Promise<void> {
  const requiredEnvVars = [
    'POSTGRES_DB',
    'POSTGRES_HOST',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_PORT',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Required environment variable ${envVar} is not set`);
    }
  }

  await Postgres.connect({
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    database: process.env.POSTGRES_DB as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT!) as number,
  });
}

// Model Configuration
function getModelSelectorConfig(): ModelSelectorConfig {
  const fast: ModelConfig = {
    provider: ModelProviders.OpenAI,
    modelName: 'gpt-4o-mini',
    description: 'Optimized for speed and simple tasks.',
  };

  const smart: ModelConfig = {
    provider: ModelProviders.OpenAI,
    modelName: 'gpt-4o-mini',
    description: 'Optimized for complex reasoning.',
  };

  const cheap: ModelConfig = {
    provider: ModelProviders.OpenAI,
    modelName: 'gpt-4o-mini',
    description: 'Good cost-performance balance.',
  };

  return {
    debugMode: false,
    useModelSelector: true,
    modelsConfig: {
      fast,
      cheap,
      smart,
    },
  };
}

/**
 * Create an agent instance by ID
 * @param agentId - The unique identifier of the agent
 * @returns Promise<{agent: SnakAgent, modelSelector: ModelSelector, config: AgentConfigSQL}>
 */
export async function createAgentById(agentId: string): Promise<{
  agent: SnakAgent;
  modelSelector: ModelSelector;
  config: AgentConfigSQL;
}> {
  // Ensure database connection
  await ensureDbConnection();

  // Query agent configuration
  const query = new Postgres.Query('SELECT * from agents WHERE id = $1', [
    agentId,
  ]);
  const queryResult = await Postgres.query<AgentConfig.Input>(query);

  if (!queryResult || queryResult.length === 0) {
    throw new Error(`No agent found for id: ${agentId}`);
  }

  // Parse agent configuration
  const agentConfig = {
    ...queryResult[0],
  };

  // Build system prompt
  const systemPrompt = buildSystemPromptFromConfig({
    name: agentConfig.profile.name,
    description: agentConfig.profile.description,
    contexts: agentConfig.profile.contexts,
  });

  const systemMessage = new SystemMessage(systemPrompt);
  const modelSelectorConfig = getModelSelectorConfig();

  validateAgent(agentConfig as AgentConfig.WithOptionalParam);
  // Create agent instance
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
      id: agentConfig.id,
      name: agentConfig.profile.name,
      group: agentConfig.group,
      description: agentConfig.description,
      prompt: systemMessage,
      interval: agentConfig.interval,
      max_iterations: agentConfig.max_iterations,
      mode: agentConfig.mode,
      chatId: 'test',
      memory: agentConfig.memory,
      rag: agentConfig.rag,
      plugins: agentConfig.plugins,
      mcp_servers: {},
    },
    modelSelectorConfig: modelSelectorConfig,
    memory: agentConfig.memory,
  });

  // Initialize model selector
  const modelSelector = new ModelSelector(modelSelectorConfig);
  await modelSelector.init();
  await agent.init();

  return { agent, modelSelector, config: agentConfig };
}

/**
 * Create an interactive agent graph
 * @param agentId - The unique identifier of the agent
 * @returns Promise<any> - The initialized graph
 */
export async function createInteractiveAgent(agentId: string): Promise<any> {
  const { agent, modelSelector } = await createAgentById(agentId);
  const interactiveAgent = new Graph(agent, modelSelector);
  const { app } = await interactiveAgent.initialize();
  return app;
}

/**
 * Create an autonomous agent graph
 * @param agentId - The unique identifier of the agent
 * @returns Promise<any> - The initialized graph
 */
export async function createAutonomousAgent(agentId: string): Promise<any> {
  const { agent, modelSelector } = await createAgentById(agentId);
  const autonomousAgent = new Graph(agent, modelSelector);
  const { app } = await autonomousAgent.initialize();
  return app;
}

/**
 * Create a hybrid agent graph
 * @param agentId - The unique identifier of the agent
 * @returns Promise<any> - The initialized graph
 */
export async function createHybridAgent(agentId: string): Promise<any> {
  const { agent, modelSelector } = await createAgentById(agentId);
  const hybridAgent = new Graph(agent, modelSelector);
  const { app } = await hybridAgent.initialize();
  return app;
}

// Example usage with specific IDs (for backward compatibility)
const AUTONOMOUS_ID = '223d72b7-7b61-43af-bbf6-278e69994b3f';
const INTERACTIVE_ID = '683513b2-83fb-4e0a-8a30-ac6a23640595';
const HYBRID_ID = 'e5ad188c-c47d-4e6a-aee5-3be8dfb4647e';

export const studio_graph_interactive = () =>
  createInteractiveAgent(INTERACTIVE_ID);
export const studio_graph_autonomous = () =>
  createAutonomousAgent(AUTONOMOUS_ID);
export const studio_graph_hybrid = () => createHybridAgent(HYBRID_ID);
