/** File deprecated **/
import { Graph } from '@agents/graphs/core-graph/agent.graph.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AgentConfig, StarknetConfig } from '@snakagent/core';
import { Postgres } from '@snakagent/database';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { SnakAgent } from '@agents/core/snakAgent.js';
import {
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@prompts/index.js';
async function getAgentConfigFromId(agentId: string) {
  await Postgres.connect({
    database: process.env.POSTGRES_DB as string,
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT as string),
  });
  const query = new Postgres.Query(
    `
      SELECT
        id,
        user_id,
        row_to_json(profile) as profile,
        mcp_servers as "mcp_servers",
        row_to_json(graph) as graph,
        row_to_json(memory) as memory,
        row_to_json(rag) as rag,
      FROM agents
      WHERE id = $1
    `,
    [agentId]
  );
  const result = await Postgres.query<AgentConfig.OutputWithId>(query);
  if (result.length === 0) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  return result[0];
}
/**
 * Create an autonomous agent graph
 * @param agentId - The unique identifier of the agent
 * @returns Promise<any> - The initialized graph
 */
export async function createAutonomousAgent(agentId: string): Promise<any> {
  const agent_config = await getAgentConfigFromId(agentId);
  if (!agent_config) {
    throw new Error(`Agent with ID ${agentId} not found`);
  }
  let model = process.env.DEFAULT_MODEL_PROVIDER;
  if (!model) {
    throw new Error('Model configuration is not defined');
  }
  let modelInstance: BaseChatModel | null = null;
  const commonConfig = {
    modelName: process.env.DEFAULT_MODEL_NAME as string,
    verbose: false,
    temperature: parseFloat(process.env.DEFAULT_TEMPERATURE ?? '0.7'),
  };
  switch (model.toLowerCase()) {
    case 'openai':
      modelInstance = new ChatOpenAI({
        ...commonConfig,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      break;
    case 'anthropic':
      modelInstance = new ChatAnthropic({
        ...commonConfig,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      });
      break;
    case 'gemini':
      modelInstance = new ChatGoogleGenerativeAI({
        model: commonConfig.modelName, // Updated to valid Gemini model name
        verbose: commonConfig.verbose,
        temperature: commonConfig.temperature,
        apiKey: process.env.GEMINI_API_KEY,
      });
      break;
    // Add case for 'deepseek' if a Langchain integration exists or becomes available
    default:
      throw new Error('No valid model provided');
  }

  const agent: AgentConfig.Runtime = {
    ...agent_config,
    prompts: {
      task_executor_prompt: TASK_EXECUTOR_SYSTEM_PROMPT,
      task_manager_prompt: TASK_MANAGER_SYSTEM_PROMPT,
      task_memory_manager_prompt: TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
      task_verifier_prompt: TASK_VERIFIER_SYSTEM_PROMPT,
    },
    graph: {
      ...agent_config.graph,
      model: modelInstance,
    },
  };
  const starknetConfig: StarknetConfig = {
    provider: this.config.starknet.provider,
    accountPrivateKey: this.config.starknet.privateKey,
    accountPublicKey: this.config.starknet.publicKey,
  };
  const snakAgent: SnakAgent = new SnakAgent(starknetConfig, agent, {
    database: process.env.POSTGRES_DB as string,
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT as string),
  });
  const autonomousAgent = new Graph(snakAgent);
  const app = await autonomousAgent.initialize();
  return app;
}

// Example usage with specific IDs (for backward compatibility)
const AUTONOMOUS_ID = '223d72b7-7b61-43af-bbf6-278e69994b3f';

export const studio_graph_autonomous = () =>
  createAutonomousAgent(AUTONOMOUS_ID);
