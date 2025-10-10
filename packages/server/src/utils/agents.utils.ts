import { ChatAnthropic } from '@langchain/anthropic';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ModelConfig } from '@snakagent/core';
import { logger } from 'starknet';

/**
 * Initializes model instances based on the loaded configuration.
 * @throws {Error} If models configuration is not loaded.
 */
export function initializeModels(model: ModelConfig): BaseChatModel | null {
  try {
    if (!model) {
      throw new Error('Model configuration is not defined');
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
          model: model.model_name, // Updated to valid Gemini model name
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
      `Failed to initialize model ${model.provider}: ${model.model_name}): ${error}`
    );
    return null;
  }
}
