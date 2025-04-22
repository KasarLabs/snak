import { z } from 'zod';

// Available AI models for each provider
const AI_PROVIDER_MODELS = {
  openai: [
    'o1',
    'o1-pro',
    'o3-mini',
    'o1-mini',
    'gpt-4.5-preview',
    'gpt-4o',
    'gpt-4o-2024-08-06',
    'gpt-4o-mini',
    'gpt-4o-mini-2024-07-18',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-1106',
    'gpt-4-turbo',
    'gpt-4-turbo-2024-04-09',
    'gpt-4-turbo-preview',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    'gpt-4',
    'gpt-4-0613',
    'gpt-4o-2024-11-20',
    'gpt-4o-2024-05-13',
  ],
  anthropic: [
    'claude-3-5-sonnet-latest',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-opus-latest',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-5-haiku-20241022-v1:0',
    'anthropic.claude-3-opus-20240229-v1:0',
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'claude-3-5-sonnet-v2@20241022',
    'claude-3-5-haiku@20241022',
    'claude-3-opus@20240229',
    'claude-3-sonnet@20240229',
    'claude-3-haiku@20240307',
  ],
  gemini: [
    'gemini-2.5-pro-preview-03-25',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash',
    'gemini-1.5-flash-8b',
    'gemini-1.5-pro',
    'gemini-1.0-pro',
    'gemini-1.5-flash-8b-latest',
    'gemini-1.5-flash-8b-001',
    'gemini-1.5-pro-latest',
    'gemini-1.5-pro-001',
    'gemini-1.5-pro-002',
  ],
  ollama: [
    'llama3.3',
    'llama3.2',
    'llama3.1',
    'mistral',
    'llama3',
    'llama2',
    'codellama',
    'mistral-nemo',
  ],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
};

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  SERVER_PORT: z.coerce.number().default(3000),
  SERVER_API_KEY: z.string(),

  STARKNET_PRIVATE_KEY: z.string(),
  STARKNET_PUBLIC_ADDRESS: z.string(),
  STARKNET_RPC_URL: z.string().url(),

  AI_MODEL_LEVEL: z.string().optional().default('smart'),
  AI_MODELS_CONFIG_PATH: z
    .string()
    .optional()
    .default('config/models/default.models.json'),

  // Provider-specific API Keys (optional)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  // Add other provider keys here if needed
});

// Type inference
export type EnvConfig = z.infer<typeof envSchema>;
