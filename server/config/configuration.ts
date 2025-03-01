import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcProvider } from 'starknet';
import { envSchema, type EnvConfig } from './env.validation'; // Add this import

@Injectable()
export class ConfigurationService {
  private readonly config: EnvConfig;

  constructor(private configService: ConfigService) {
    // First, collect all env variables
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
      AI_PROVIDER: this.configService.get<string>('AI_PROVIDER'),
      AI_MODEL: this.configService.get<string>('AI_MODEL'),
      AI_PROVIDER_API_KEY: this.configService.get<string>(
        'AI_PROVIDER_API_KEY'
      ),
    };

    const result = envSchema.safeParse(envVariables);

    if (!result.success) {
      console.error(
        '❌ Invalid environment variables:',
        JSON.stringify(result.error.format(), null, 2)
      );
      throw new Error('Invalid environment variables');
    }

    this.config = result.data;
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

  get ai() {
    return {
      provider: this.config.AI_PROVIDER,
      model: this.config.AI_MODEL,
      apiKey: this.config.AI_PROVIDER_API_KEY,
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
