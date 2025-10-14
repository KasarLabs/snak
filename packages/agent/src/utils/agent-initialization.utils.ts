import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import {
  TASK_EXECUTOR_SYSTEM_PROMPT,
  TASK_MANAGER_SYSTEM_PROMPT,
  TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
  TASK_VERIFIER_SYSTEM_PROMPT,
} from '@prompts/index.js';
import {
  ModelConfig,
  AgentConfig,
  AgentPromptsInitialized,
} from '@snakagent/core';
import { logger } from '@snakagent/core';
import { agents } from '@snakagent/database/queries';

/**
 * Initializes model instances based on the loaded configuration.
 * @param {ModelConfig} model - The model configuration
 * @returns {BaseChatModel | null} Model instance or null if initialization fails.
 */
export function initializeModels(model: ModelConfig): BaseChatModel | null {
  try {
    if (!model) {
      throw new Error('Model configuration is not defined');
    }
    if (!model.model_provider) {
      throw new Error('Model provider is not defined');
    }
    let modelInstance: BaseChatModel | null = null;
    const commonConfig = {
      modelName: model.model_name,
      verbose: false,
      temperature: model.temperature,
    };
    switch (model.model_provider.toLowerCase()) {
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
          model: model.model_name,
          verbose: false,
          temperature: model.temperature,
          apiKey: process.env.GEMINI_API_KEY,
        });
        break;
      // Add case for 'deepseek' if a Langchain integration exists or becomes available
      default:
        throw new Error('No valid model provided');
    }
    return modelInstance;
  } catch (error) {
    logger.error(
      `Failed to initialize model ${model.model_provider}: ${model.model_name}: ${error}`
    );
    return null;
  }
}

/**
 * Creates an AgentConfig.Runtime from an AgentConfig.OutputWithId
 * This function handles the full initialization of an agent's runtime configuration
 * including model initialization and prompts loading
 *
 * @param {AgentConfig.OutputWithId} agentConfigOutputWithId - The agent configuration with ID from database
 * @returns {Promise<AgentConfig.Runtime | undefined>} The runtime configuration or undefined if initialization fails
 */
export async function createAgentConfigRuntimeFromOutputWithId(
  agentConfigOutputWithId: AgentConfig.OutputWithId
): Promise<AgentConfig.Runtime | undefined> {
  try {
    // Get model configuration from the agent's graph configuration
    const dbModel = agentConfigOutputWithId.graph.model;
    if (!dbModel) {
      throw new Error(
        `Failed to get model configuration from agent ${agentConfigOutputWithId.id}`
      );
    }

    // Map database fields to TypeScript interface
    // Database uses: model_provider, model_name, temperature, max_tokens
    // TypeScript expects: provider, model_name, temperature, max_tokens
    const model: ModelConfig = {
      model_provider: dbModel.model_provider || dbModel.model_provider,
      model_name: dbModel.model_name,
      temperature: dbModel.temperature,
      max_tokens: dbModel.max_tokens,
    };

    // Initialize model instance
    const modelInstance = initializeModels(model);
    if (!modelInstance) {
      throw new Error('Failed to initialize model for agent');
    }

    // Parse to proper format
    const prompts: AgentPromptsInitialized<string> = {
      task_executor_prompt: TASK_EXECUTOR_SYSTEM_PROMPT,
      task_manager_prompt: TASK_MANAGER_SYSTEM_PROMPT,
      task_memory_manager_prompt: TASK_MEMORY_MANAGER_SYSTEM_PROMPT,
      task_verifier_prompt: TASK_VERIFIER_SYSTEM_PROMPT,
    };

    // Construct runtime configuration
    const agentConfigRuntime: AgentConfig.Runtime = {
      ...agentConfigOutputWithId,
      prompts: prompts,
      graph: {
        ...agentConfigOutputWithId.graph,
        model: modelInstance,
      },
    };

    return agentConfigRuntime;
  } catch (error) {
    logger.error('Agent configuration runtime creation failed:', error);
    throw error;
  }
}
