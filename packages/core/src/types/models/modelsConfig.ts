import { ModelProviders } from './models.js';

/**
 * Configuration for a single AI model level.
 */
export interface ModelConfig {
  /**
   * The provider of the AI model (e.g., "openai", "anthropic", "gemini").
   */
  provider: ModelProviders;

  /**
   * The specific name of the model (e.g., "gpt-4o-mini", "claude-3-haiku-20240307", "gemini-1.5-flash").
   */
  modelName: string;

  /**
   * An optional description for this model level.
   */
  description?: string;

  /**
   * The maximum number of input tokens per request.
   */
  maxInputTokens?: number;

  /**
   * The maximum number of output tokens per request.
   */
  maxOutputTokens?: number;
}

/**
 * Defines the configuration structure for different AI model levels.
 */
export interface ModelsConfig {
  /**
   * Configuration for the "fast" model level, optimized for speed and simple tasks.
   */
  fast: ModelConfig;

  /**
   * Configuration for the "smart" model level, optimized for complex reasoning.
   */
  smart: ModelConfig;

  /**
   * Configuration for the "cheap" model level, offering a balance between cost and performance.
   */
  cheap: ModelConfig;

  /**
   * Allows defining additional custom model levels.
   */
  [levelName: string]: ModelConfig;
}

/**
 * Defines the structure for storing API keys for various AI providers.
 */
export interface ApiKeys {
  /**
   * API key for OpenAI services.
   */
  openai?: string;

  /**
   * API key for Anthropic services.
   */
  anthropic?: string;

  /**
   * API key for Google Gemini services.
   */
  gemini?: string;

  /**
   * API key for DeepSeek services.
   */
  deepseek?: string;

  /**
   * Allows storing API keys for other providers.
   */
  [providerName: string]: string | undefined;
}
