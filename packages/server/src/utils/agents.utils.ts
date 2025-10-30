import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  AgentConfig,
  AgentConfigDefaults,
  ModelConfig,
  logger,
} from '@snakagent/core';

const SUPPORTED_GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-pro'];

/**
 * Initializes Gemini model instances based on the loaded configuration.
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

    // Only support Gemini provider
    if (model.model_provider.toLowerCase() !== 'gemini') {
      throw new Error(
        `Unsupported provider: ${model.model_provider}. Only 'gemini' is supported.`
      );
    }

    // Validate model name
    if (!SUPPORTED_GEMINI_MODELS.includes(model.model_name)) {
      throw new Error(
        `Unsupported Gemini model: ${model.model_name}. Supported models: ${SUPPORTED_GEMINI_MODELS.join(', ')}`
      );
    }
    const modelInstance = new ChatGoogleGenerativeAI({
      model: model.model_name,
      verbose: false,
      temperature: model.temperature,
      apiKey: process.env.GEMINI_API_KEY,
    });

    return modelInstance;
  } catch (error) {
    logger.error(
      `Failed to initialize model ${model.model_provider}: ${model.model_name}: ${error}`
    );
    return null;
  }
}

export function initializeAgentConfigIfMissingParams(
  agentConfig: AgentConfig.InputWithPartialConfig
): AgentConfig.Input {
  try {
    if (!agentConfig.mcp_servers) {
      agentConfig.mcp_servers = AgentConfigDefaults.mcp_servers;
    }
    if (!agentConfig.memory) {
      agentConfig.memory = AgentConfigDefaults.memory;
    }
    if (!agentConfig.rag) {
      agentConfig.rag = AgentConfigDefaults.rag;
    }
    if (!agentConfig.graph) {
      agentConfig.graph = AgentConfigDefaults.graph;
    }
    return agentConfig as AgentConfig.Input;
  } catch (error) {
    throw error;
  }
}
