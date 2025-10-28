import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ModelConfig, logger } from '@snakagent/core';

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
    if (!model.provider) {
      throw new Error('Model provider is not defined');
    }

    // Only support Gemini provider
    if (model.provider.toLowerCase() !== 'gemini') {
      throw new Error(
        `Unsupported provider: ${model.provider}. Only 'gemini' is supported.`
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
      `Failed to initialize model ${model.provider}: ${model.model_name}: ${error}`
    );
    return null;
  }
}
