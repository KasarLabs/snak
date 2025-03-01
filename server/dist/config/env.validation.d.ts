import { z } from 'zod';
export declare const envSchema: z.ZodEffects<z.ZodObject<{
    SERVER_PORT: z.ZodDefault<z.ZodEffects<z.ZodString, number, string>>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    SERVER_API_KEY: z.ZodString;
    STARKNET_PRIVATE_KEY: z.ZodString;
    STARKNET_PUBLIC_ADDRESS: z.ZodString;
    STARKNET_RPC_URL: z.ZodString;
    AI_PROVIDER_API_KEY: z.ZodString;
    AI_PROVIDER: z.ZodUnion<[z.ZodLiteral<"openai">, z.ZodLiteral<"anthropic">, z.ZodLiteral<"ollama">, z.ZodLiteral<"gemini">, z.ZodLiteral<"deepseek">]>;
    AI_MODEL: z.ZodString;
}, "strip", z.ZodTypeAny, {
    SERVER_PORT: number;
    NODE_ENV: "development" | "production" | "test";
    SERVER_API_KEY: string;
    STARKNET_PRIVATE_KEY: string;
    STARKNET_PUBLIC_ADDRESS: string;
    STARKNET_RPC_URL: string;
    AI_PROVIDER_API_KEY: string;
    AI_PROVIDER: "openai" | "anthropic" | "ollama" | "gemini" | "deepseek";
    AI_MODEL: string;
}, {
    SERVER_API_KEY: string;
    STARKNET_PRIVATE_KEY: string;
    STARKNET_PUBLIC_ADDRESS: string;
    STARKNET_RPC_URL: string;
    AI_PROVIDER_API_KEY: string;
    AI_PROVIDER: "openai" | "anthropic" | "ollama" | "gemini" | "deepseek";
    AI_MODEL: string;
    SERVER_PORT?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
}>, {
    SERVER_PORT: number;
    NODE_ENV: "development" | "production" | "test";
    SERVER_API_KEY: string;
    STARKNET_PRIVATE_KEY: string;
    STARKNET_PUBLIC_ADDRESS: string;
    STARKNET_RPC_URL: string;
    AI_PROVIDER_API_KEY: string;
    AI_PROVIDER: "openai" | "anthropic" | "ollama" | "gemini" | "deepseek";
    AI_MODEL: string;
}, {
    SERVER_API_KEY: string;
    STARKNET_PRIVATE_KEY: string;
    STARKNET_PUBLIC_ADDRESS: string;
    STARKNET_RPC_URL: string;
    AI_PROVIDER_API_KEY: string;
    AI_PROVIDER: "openai" | "anthropic" | "ollama" | "gemini" | "deepseek";
    AI_MODEL: string;
    SERVER_PORT?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
}>;
export type EnvConfig = z.infer<typeof envSchema>;
