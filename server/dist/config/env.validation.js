"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envSchema = void 0;
const zod_1 = require("zod");
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
exports.envSchema = zod_1.z
    .object({
    SERVER_PORT: zod_1.z
        .string()
        .transform((val) => parseInt(val, 10))
        .default('3001'),
    NODE_ENV: zod_1.z
        .enum(['development', 'production', 'test'])
        .default('development'),
    SERVER_API_KEY: zod_1.z
        .string()
        .min(1, 'API key is required for server authentication'),
    STARKNET_PRIVATE_KEY: zod_1.z
        .string()
        .min(1, 'Starknet private key is required for blockchain transactions'),
    STARKNET_PUBLIC_ADDRESS: zod_1.z
        .string()
        .min(1, 'Public address is required for blockchain interactions'),
    STARKNET_RPC_URL: zod_1.z
        .string()
        .url('Invalid RPC URL. Please provide a valid blockchain RPC endpoint'),
    AI_PROVIDER_API_KEY: zod_1.z
        .string()
        .min(1, 'AI provider API key is required for machine learning services'),
    AI_PROVIDER: zod_1.z.union([
        zod_1.z.literal('openai'),
        zod_1.z.literal('anthropic'),
        zod_1.z.literal('ollama'),
        zod_1.z.literal('gemini'),
        zod_1.z.literal('deepseek'),
    ], {
        errorMap: () => ({
            message: 'Invalid AI model provider. Must be one of: openai, anthropic, ollama, gemini or deepseek.',
        }),
    }),
    AI_MODEL: zod_1.z.string().min(1, 'AI model name cannot be empty'),
})
    .superRefine((data, ctx) => {
    const provider = data.AI_PROVIDER;
    const availableModels = AI_PROVIDER_MODELS[provider];
    if (!availableModels.includes(data.AI_MODEL)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Invalid model "${data.AI_MODEL}" for provider "${provider}". Available models are: ${availableModels.join(', ')}`,
        });
    }
});
//# sourceMappingURL=env.validation.js.map