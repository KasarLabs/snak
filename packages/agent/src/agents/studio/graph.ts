import { SystemMessage } from '@langchain/core/messages';
import { AgentMode, ModelLevelConfig, ModelProviders } from '@snakagent/core';
import { Postgres } from '@snakagent/database';
import { SnakAgent } from '../core/snakAgent.js';
import { InteractiveAgent } from '../modes/interactive.js';
import { AutonomousAgent } from '../modes/autonomous.js';
import {
  ModelSelector,
  ModelSelectorConfig,
} from '../operators/modelSelector.js';
import { RpcProvider } from 'starknet';
import { logger } from '@snakagent/core';
// Types and Interfaces
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
  mcpServers : Record<string,any>
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
  const queryResult = await Postgres.query<AgentConfigSQL>(query);

  if (!queryResult || queryResult.length === 0) {
    throw new Error(`No agent found for id: ${agentId}`);
  }

  // Parse agent configuration
  const agentConfig = {
    ...queryResult[0],
    memory: parseMemoryConfig(queryResult[0].memory),
    rag: parseRagConfig(queryResult[0].rag),
  };

  // Build system prompt
  const systemPrompt = buildSystemPromptFromConfig({
    name: agentConfig.name,
    description: agentConfig.description,
    lore: agentConfig.lore,
    objectives: agentConfig.objectives,
    knowledge: agentConfig.knowledge,
  });

  const systemMessage = new SystemMessage(systemPrompt);
  const modelSelectorConfig = getModelSelectorConfig();

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
      name: agentConfig.name,
      group: agentConfig.group,
      description: agentConfig.description,
      prompt: systemMessage,
      interval: agentConfig.interval,
      maxIterations: agentConfig.max_iterations,
      mode: agentConfig.mode,
      chatId: 'test',
      memory: agentConfig.memory,
      rag: agentConfig.rag,
      plugins: agentConfig.plugins,
      mcpServers: agentConfig.mcpServers,
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
  const interactiveAgent = new InteractiveAgent(agent, modelSelector);
  const { app } = await interactiveAgent.initialize();
  return app;
}

/**
 * Create an autonomous agent graph
 * @param agentId - The unique identifier of the agent
 * @returns Promise<any> - The initialized graph
 */
export async function createAutonomousAgent(agentId: string): Promise<any> {
  const { agent, modelSelector } = await createAgentById(AUTONOMOUS_ID);
  const autonomousAgent = new AutonomousAgent(agent, modelSelector);

  const result = await autonomousAgent.initialize();
  const app = result.app;

  // Vérifier que app existe
  if (!app) {
    throw new Error('App is undefined after initialization');
  }

  return app;
}

/**
 * Create a hybrid agent graph
 * @param agentId - The unique identifier of the agent
 * @returns Promise<any> - The initialized graph
 */
export async function createHybridAgent(agentId: string): Promise<any> {
  const { agent, modelSelector } = await createAgentById(agentId);
  const hybridAgent = new AutonomousAgent(agent, modelSelector);
  const { app } = await hybridAgent.initialize();
  return app;
}

// Example usage with specific IDs (for backward compatibility)
const AUTONOMOUS_ID = 'b1e5aa50-b028-44eb-a4ce-ddc426a17836';
const INTERACTIVE_ID = 'f1367901-976d-4319-9cb1-b9afe2999e19';
const HYBRID_ID = 'f1367901-976d-4319-9cb1-b9afe2999e19';

// export const studio_graph_interactive = () =>
//   createInteractiveAgent(INTERACTIVE_ID);
export const studio_graph_autonomous = () =>
  createAutonomousAgent(AUTONOMOUS_ID);
// export const studio_graph_hybrid = () => createHybridAgent(HYBRID_ID);