import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envSchema, type EnvConfig } from './env.validation.js';
import { RagConfigSize } from '@snakagent/core'; // Assuming core exports these types

@Injectable()
export class ConfigurationService {
  private readonly logger = new Logger(ConfigurationService.name);
  private readonly config: EnvConfig;
  private readonly ragConfig: RagConfigSize;

  constructor(private configService: ConfigService) {
    // Collect all env variables specified in the schema
    const envVariables = {
      NODE_ENV: this.configService.get<string>('NODE_ENV'),
      SERVER_PORT: this.configService.get<string>('SERVER_PORT'),
      SERVER_API_KEY: this.configService.get<string>('SERVER_API_KEY'),
      AI_MODEL_LEVEL: this.configService.get<string>('AI_MODEL_LEVEL'),
      AI_MODELS_CONFIG_PATH: this.configService.get<string>(
        'AI_MODELS_CONFIG_PATH'
      ),
      GEMINI_API_KEY: this.configService.get<string>('GEMINI_API_KEY'),
      SMITHERY_API_KEY: this.configService.get<string>('SMITHERY_API_KEY'),
      DEFAULT_MODEL_PROVIDER: this.configService.get<string>(
        'DEFAULT_MODEL_PROVIDER'
      ),
      DEFAULT_MODEL_NAME: this.configService.get<string>('DEFAULT_MODEL_NAME'),
      DEFAULT_TEMPERATURE: this.configService.get<number>(
        'DEFAULT_TEMPERATURE'
      ),
      GUARDS_CONFIG_PATH: this.configService.get<string>('GUARDS_CONFIG_PATH'),
      REDIS_HOST: this.configService.get<string>('REDIS_HOST'),
      REDIS_PORT: this.configService.get<string>('REDIS_PORT'),
      REDIS_PASSWORD: this.configService.get<string>('REDIS_PASSWORD'),
      REDIS_DB: this.configService.get<string>('REDIS_DB'),
      // Add others if needed
    };

    const result = envSchema.safeParse(envVariables);

    if (!result.success) {
      // Format validation errors in a user-friendly way
      const errors = result.error.format() as any;
      const errorMessages: string[] = [];

      Object.keys(errors).forEach((key) => {
        if (key !== '_errors' && errors[key]?._errors?.length > 0) {
          const errorList = errors[key]._errors.join(', ');
          errorMessages.push(`  - ${key}: ${errorList}`);
        }
      });

      const formattedError =
        errorMessages.length > 0
          ? `\n\nMissing or invalid environment variables:\n${errorMessages.join('\n')}\n\nPlease check your .env file and ensure all required variables are set.\n`
          : JSON.stringify(errors, null, 2);

      this.logger.error(formattedError);
      throw new Error(
        'Invalid environment variables. Check logs above for details.'
      );
    }

    this.config = result.data;
    // try {
    //   const content = readFileSync(this.ragConfigPath, 'utf-8');
    //   this.ragConfig = JSON.parse(content) as RagConfigSize;
    // } catch (err) {
    //   this.logger.error(
    //     `Failed to load rag config from ${this.ragConfigPath}:`,
    //     err as any
    //   );
    //   this.ragConfig = {
    //     maxAgentSize: 1_000_000,
    //     maxProcessSize: 50_000_000,
    //     maxRagSize: 501_000,
    //   };
    // }
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

  get rag() {
    return this.ragConfig;
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

  get redis() {
    const {
      REDIS_HOST: host,
      REDIS_PORT: port,
      REDIS_PASSWORD,
      REDIS_DB: db,
    } = this.config;
    return {
      host,
      port,
      password: REDIS_PASSWORD || '',
      db,
    };
  }

  get geminiApiKey(): string {
    return this.config.GEMINI_API_KEY;
  }

  get smitheryApiKey(): string {
    return this.config.SMITHERY_API_KEY;
  }

  get defaultModel() {
    return {
      provider: this.config.DEFAULT_MODEL_PROVIDER,
      name: this.config.DEFAULT_MODEL_NAME,
      temperature: this.config.DEFAULT_TEMPERATURE,
    };
  }
}
