import { z } from 'zod';

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
  // Documents max size configuration
  DOCUMENTS_CONFIG_PATH: z
    .string()
    .optional()
    .default('config/documents/default.documents.json'),
  // Add other provider keys here if needed
});

// Type inference
export type EnvConfig = z.infer<typeof envSchema>;
