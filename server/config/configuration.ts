import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcProvider } from 'starknet';
import { envSchema, type EnvConfig } from './env.validation.js';
import * as fs from 'fs';
import * as path from 'path';
import { ModelsConfig, ModelLevelConfig } from '@hijox/core'; // Assuming core exports these types

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);
  private readonly config: EnvConfig;
  private readonly modelsConfig: ModelsConfig;
  private readonly modelsConfigPath: string;

  constructor(private configService: ConfigService) {
    // Collect all env variables specified in the schema
    const envVariables = {
      NODE_ENV: this.configService.get<string>('NODE_ENV'),
      SERVER_PORT: this.configService.get<string>('SERVER_PORT'),
      SERVER_API_KEY: this.configService.get<string>('SERVER_API_KEY'),
      STARKNET_PRIVATE_KEY: this.configService.get<string>(
        'STARKNET_PRIVATE_KEY'
      ),
      STARKNET_PUBLIC_ADDRESS: this.configService.get<string>(
        'STARKNET_PUBLIC_ADDRESS'
      ),
      STARKNET_RPC_URL: this.configService.get<string>('STARKNET_RPC_URL'),
      AI_MODEL_LEVEL: this.configService.get<string>('AI_MODEL_LEVEL'),
      AI_MODELS_CONFIG_PATH: this.configService.get<string>(
        'AI_MODELS_CONFIG_PATH'
      ),
      OPENAI_API_KEY: this.configService.get<string>('OPENAI_API_KEY'),
      ANTHROPIC_API_KEY: this.configService.get<string>('ANTHROPIC_API_KEY'),
      GEMINI_API_KEY: this.configService.get<string>('GEMINI_API_KEY'),
      DEEPSEEK_API_KEY: this.configService.get<string>('DEEPSEEK_API_KEY'),
      // Add others if needed
    };

    const result = envSchema.safeParse(envVariables);

    if (!result.success) {
      this.logger.error(
        '❌ Invalid environment variables:',
        JSON.stringify(result.error.format(), null, 2)
      );
      throw new Error('Invalid environment variables');
    }

    this.config = result.data;

    // Resolve and load models config
    this.modelsConfigPath = path.resolve(
      process.cwd(),
      this.config.AI_MODELS_CONFIG_PATH
    );
    try {
      const modelsFileContent = fs.readFileSync(this.modelsConfigPath, 'utf-8');
      this.modelsConfig = JSON.parse(modelsFileContent);
      this.logger.log(
        `✅ Models configuration loaded from ${this.modelsConfigPath}`
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to load models configuration from ${this.modelsConfigPath}:`,
        error
      );
      throw new Error(`Failed to load models configuration: ${error.message}`);
    }
  }

  get port(): number {
    return this.config.SERVER_PORT;
  }

  get nodeEnv(): string {
    return this.config.NODE_ENV;
  }

  get apiKey(): string {
    return this.config.SERVER_API_KEY;
  }

  get starknet() {
    return {
      privateKey: this.config.STARKNET_PRIVATE_KEY,
      publicKey: this.config.STARKNET_PUBLIC_ADDRESS,
      provider: new RpcProvider({ nodeUrl: this.config.STARKNET_RPC_URL }),
    };
  }

  private getApiKeyForProvider(provider: string): string {
    let apiKey: string | undefined;
    switch (provider.toLowerCase()) {
      case 'openai':
        apiKey = this.config.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = this.config.ANTHROPIC_API_KEY;
        break;
      case 'gemini':
        apiKey = this.config.GEMINI_API_KEY;
        break;
      case 'deepseek':
        apiKey = this.config.DEEPSEEK_API_KEY;
        break;
      // Add cases for other providers
      default:
        this.logger.warn(`API key requested for unknown provider: ${provider}`);
      // Optionally throw an error or return undefined based on requirements
      // For now, we allow it but it might fail later if the key is actually needed
    }
    if (!apiKey) {
      throw new Error(
        `API key for provider "${provider}" is not configured in environment variables.`
      );
    }
    return apiKey;
  }

  get ai() {
    const modelLevel = this.config.AI_MODEL_LEVEL as keyof ModelsConfig;
    const selectedModelConfig: ModelLevelConfig | undefined =
      this.modelsConfig[modelLevel];

    if (!selectedModelConfig) {
      const availableLevels = Object.keys(this.modelsConfig).join(', ');
      throw new Error(
        `Invalid AI_MODEL_LEVEL: "${modelLevel}". Available levels: ${availableLevels}`
      );
    }

    const provider = selectedModelConfig.provider;
    const model = selectedModelConfig.model_name;
    const apiKey = this.getApiKeyForProvider(provider);

    return {
      provider,
      model,
      apiKey,
      modelsConfigPath: this.modelsConfigPath,
    };
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }
}
