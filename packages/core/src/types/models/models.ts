import { ModelConfig } from './modelsConfig.js';

/**
 * Defines the known AI model providers.
 */
export enum ModelProviders {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Gemini = 'gemini',
  DeepSeek = 'deepseek',
}

// OpenAI Models
export const GPT_4O_MINI: ModelConfig = {
  modelName: 'gpt-4o-mini',
  provider: ModelProviders.OpenAI,
  description:
    "OpenAI's most advanced small model, optimized for speed and cost.",
};

export const GPT_4_TURBO: ModelConfig = {
  modelName: 'gpt-4-turbo',
  provider: ModelProviders.OpenAI,
  description:
    "OpenAI's model with a 128k context window, optimized for complex tasks.",
};

// Anthropic Models
export const CLAUDE_3_HAIKU: ModelConfig = {
  modelName: 'claude-3-haiku-20240307',
  provider: ModelProviders.Anthropic,
  description:
    "Anthropic's fastest and most compact model for near-instant responsiveness.",
};

export const CLAUDE_3_SONNET: ModelConfig = {
  modelName: 'claude-3-sonnet-20240229',
  provider: ModelProviders.Anthropic,
  description: "Anthropic's model balancing intelligence and speed.",
};

export const CLAUDE_3_OPUS: ModelConfig = {
  modelName: 'claude-3-opus-20240229',
  provider: ModelProviders.Anthropic,
  description: "Anthropic's most powerful model for highly complex tasks.",
};

// Google Gemini Models
export const GEMINI_1_5_FLASH: ModelConfig = {
  modelName: 'gemini-1.5-flash',
  provider: ModelProviders.Gemini,
  description: "Google's fast and versatile multimodal model.",
};

export const GEMINI_1_5_PRO: ModelConfig = {
  modelName: 'gemini-1.5-pro',
  provider: ModelProviders.Gemini,
  description: "Google's model for scaling across a wide-range of tasks.",
};

// DeepSeek Models
export const DEEPSEEK_CODER: ModelConfig = {
  modelName: 'deepseek-coder',
  provider: ModelProviders.DeepSeek,
  description: "DeepSeek's specialized code generation model.",
};

export const DEEPSEEK_CHAT: ModelConfig = {
  modelName: 'deepseek-chat',
  provider: ModelProviders.DeepSeek,
  description: "DeepSeek's general chat model.",
};

/**
 * A list of some well-known models.
 * This is not exhaustive and can be expanded.
 */
export const MODELS: ModelConfig[] = [
  GPT_4O_MINI,
  GPT_4_TURBO,
  CLAUDE_3_HAIKU,
  CLAUDE_3_SONNET,
  CLAUDE_3_OPUS,
  GEMINI_1_5_FLASH,
  GEMINI_1_5_PRO,
  DEEPSEEK_CODER,
  DEEPSEEK_CHAT,
];

/**
 * Type guard to check if a string is a ModelProviders.
 * @param provider The string to check.
 * @returns True if the provider is a ModelProviders, false otherwise.
 */
export function isModelProvider(provider: string): provider is ModelProviders {
  return Object.values(ModelProviders).includes(provider as ModelProviders);
}
