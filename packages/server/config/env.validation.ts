import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  SERVER_PORT: z.coerce.number().default(3000),
  SERVER_API_KEY: z.string(),

  AI_MODEL_LEVEL: z.string().optional().default('smart'),
  AI_MODELS_CONFIG_PATH: z
    .string()
    .optional()
    .default('config/models/default.models.json'),

  // Provider-specific API Keys
  GEMINI_API_KEY: z.string(),

  // Default model configuration
  DEFAULT_MODEL_PROVIDER: z.string(),
  DEFAULT_MODEL_NAME: z.string(),
  DEFAULT_TEMPERATURE: z.coerce.number().min(0).max(1),

  // Rag max size configuration
  RAG_CONFIG_PATH: z.string().optional().default('config/rag/default.rag.json'),

  // Guards configuration
  GUARDS_CONFIG_PATH: z
    .string()
    .optional()
    .default('config/guards/default.guards.json'),

  // Redis configuration
  REDIS_HOST: z.string().optional().default('redis'),
  REDIS_PORT: z.coerce
    .number()
    .pipe(z.number().int().min(1).max(65535))
    .optional()
    .default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce
    .number()
    .pipe(z.number().int().min(0))
    .optional()
    .default(0),

  // Add other provider keys here if needed
});

// Type inference
export type EnvConfig = z.infer<typeof envSchema>;
