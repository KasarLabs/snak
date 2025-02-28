import { ConfigService } from '@nestjs/config';
import { RpcProvider } from 'starknet';
export declare class ConfigurationService {
    private configService;
    private readonly config;
    constructor(configService: ConfigService);
    get port(): number;
    get nodeEnv(): string;
    get apiKey(): string;
    get starknet(): {
        privateKey: string;
        publicKey: string;
        provider: RpcProvider;
    };
    get ai(): {
        provider: "openai" | "anthropic" | "ollama" | "gemini" | "deepseek";
        model: string;
        apiKey: string;
    };
    get isDevelopment(): boolean;
    get isProduction(): boolean;
    get isTest(): boolean;
}
