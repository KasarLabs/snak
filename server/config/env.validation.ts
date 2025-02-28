import { z } from 'zod';

// Available AI models for each provider
const AI_PROVIDER_MODELS = {
  openai: [
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

export const envSchema = z
  .object({
    // Server configuration
    /** Port number for the server to listen on */
    SERVER_PORT: z
      .string()
      .transform((val) => parseInt(val, 10))
      .default('3001'),

    /** Runtime environment for the application */
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    /** API key for general server authentication */
    SERVER_API_KEY: z
      .string()
      .min(1, 'API key is required for server authentication'),

    // Starknet configuration
    /** Private key for Starknet blockchain interactions */
    STARKNET_PRIVATE_KEY: z
      .string()
      .min(1, 'Starknet private key is required for blockchain transactions'),

    /** Public blockchain address for the application */
    STARKNET_PUBLIC_ADDRESS: z
      .string()
      .min(1, 'Public address is required for blockchain interactions'),

    /** RPC endpoint URL for connecting to the blockchain network */
    STARKNET_RPC_URL: z
      .string()
      .url('Invalid RPC URL. Please provide a valid blockchain RPC endpoint'),

    // AI Service configuration
    /** API key for accessing AI provider services */
    AI_PROVIDER_API_KEY: z
      .string()
      .min(1, 'AI provider API key is required for machine learning services'),

    /** Selected AI model provider for the application */
    AI_PROVIDER: z.union(
      [
        z.literal('openai'),
        z.literal('anthropic'),
        z.literal('ollama'),
        z.literal('gemini'),
        z.literal('deepseek'),
      ],
      {
        errorMap: () => ({
          message:
            'Invalid AI model provider. Must be one of: openai, anthropic, ollama, gemini or deepseek.',
        }),
      }
    ),

    /** Specific AI model to use for the selected provider */
    AI_MODEL: z.string().min(1, 'AI model name cannot be empty'),
  })
  .superRefine((data, ctx) => {
    // Get the current provider from the parent object
    const provider = data.AI_PROVIDER;

    // Get available models for the selected provider
    const availableModels = AI_PROVIDER_MODELS[provider];

    // Check if the specified model exists for the provider
    if (!availableModels.includes(data.AI_MODEL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid model "${data.AI_MODEL}" for provider "${provider}". Available models are: ${availableModels.join(', ')}`,
      });
    }
  });

// Type inference
export type EnvConfig = z.infer<typeof envSchema>;
