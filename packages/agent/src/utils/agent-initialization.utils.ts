import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ModelConfig, AgentConfig, AgentPromptsInitialized } from '@snakagent/core';
import { logger } from '@snakagent/core';

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
    if (!model.provider) {
      throw new Error('Model provider is not defined');
    }
    let modelInstance: BaseChatModel | null = null;
    const commonConfig = {
      modelName: model.model_name,
      verbose: false,
      temperature: model.temperature,
    };
    switch (model.provider.toLowerCase()) {
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
      `Failed to initialize model ${model.provider}: ${model.model_name}: ${error}`
    );
    return null;
  }
}

/**
 * Interface for database operations required for agent initialization
 * This interface should be implemented by the database layer
 */
export interface AgentInitializationDatabase {
  getPromptsById(promptId: string): Promise<AgentPromptsInitialized<string> | null>;
  getModelFromUser(userId: string): Promise<ModelConfig | null>;
}

/**
 * Creates an AgentConfig.Runtime from an AgentConfig.OutputWithId
 * This function handles the full initialization of an agent's runtime configuration
 * including model initialization and prompts loading
 *
 * @param {AgentConfig.OutputWithId} agentConfigOutputWithId - The agent configuration with ID from database
 * @param {AgentInitializationDatabase} database - Database interface for fetching prompts and model config
 * @returns {Promise<AgentConfig.Runtime | undefined>} The runtime configuration or undefined if initialization fails
 */
export async function createAgentConfigRuntimeFromOutputWithId(
  agentConfigOutputWithId: AgentConfig.OutputWithId,
  database: AgentInitializationDatabase
): Promise<AgentConfig.Runtime | undefined> {
  try {
    // Get model configuration for the user
    const model = await database.getModelFromUser(agentConfigOutputWithId.user_id);
    if (!model) {
      throw new Error(
        `Failed to get model configuration for user ${agentConfigOutputWithId.user_id}`
      );
    }

    // Initialize model instance
    const modelInstance = initializeModels(model);
    if (!modelInstance) {
      throw new Error('Failed to initialize model for agent');
    }

    // Get prompts from database
    const promptsFromDb = await database.getPromptsById(
      agentConfigOutputWithId.prompts_id
    );
    if (!promptsFromDb) {
      throw new Error(
        `Failed to load prompts for agent ${agentConfigOutputWithId.id}, prompts ID: ${agentConfigOutputWithId.prompts_id}`
      );
    }

    // Construct runtime configuration
    const agentConfigRuntime: AgentConfig.Runtime = {
      ...agentConfigOutputWithId,
      prompts: promptsFromDb,
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
