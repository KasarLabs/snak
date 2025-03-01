import { AiConfig, IAgent } from '../common';
import { createAgent } from './agent';
import { RpcProvider } from 'starknet';
import { TransactionMonitor } from '../common';
import { ContractInteractor } from '../common';
import { createAutonomousAgent } from './autonomousAgents';
import { Scraper } from 'agent-twitter-client';
import { TwitterApi } from 'twitter-api-v2';
import {
  TwitterInterface,
  TwitterApiConfig,
  TwitterScraperConfig,
} from '../common';
import { JsonConfig } from './jsonConfig';
import { TelegramInterface } from '../common';
import TelegramBot from 'node-telegram-bot-api';

export interface StarknetAgentConfig {
  aiProviderApiKey: string;
  aiModel: string;
  aiProvider: string;
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
  signature: string;
  agentMode: string;
  agentconfig?: JsonConfig;
}

export class StarknetAgent implements IAgent {
  private readonly provider: RpcProvider;
  private readonly accountPrivateKey: string;
  private readonly accountPublicKey: string;
  private readonly aiModel: string;
  private readonly aiProviderApiKey: string;
  private agentReactExecutor: any;
  private currentMode: string;
  private twitterAccoutManager: TwitterInterface = {};
  private telegramAccountManager: TelegramInterface = {};

  public readonly transactionMonitor: TransactionMonitor;
  public readonly contractInteractor: ContractInteractor;
  public readonly signature: string;
  public readonly agentMode: string;
  public readonly agentconfig?: JsonConfig | undefined;

  constructor(private readonly config: StarknetAgentConfig) {
    this.validateConfig(config);

    this.provider = config.provider;
    this.accountPrivateKey = config.accountPrivateKey;
    this.accountPublicKey = config.accountPublicKey;
    this.aiModel = config.aiModel;
    this.aiProviderApiKey = config.aiProviderApiKey;
    this.signature = config.signature;
    this.agentMode = config.agentMode;
    this.currentMode = config.agentMode;
    this.agentconfig = config.agentconfig;

    this.transactionMonitor = new TransactionMonitor(this.provider);
    this.contractInteractor = new ContractInteractor(this.provider);
  }

  public async createAgentReactExecutor() {
    const config: AiConfig = {
      aiModel: this.aiModel,
      aiProviderApiKey: this.aiProviderApiKey,
      aiProvider: this.config.aiProvider,
    };

    if (this.currentMode === 'auto') {
      this.agentReactExecutor = await createAutonomousAgent(this, config);
    } else if (this.currentMode === 'agent') {
      this.agentReactExecutor = await createAgent(this, config);
    }
  }
  private validateConfig(config: StarknetAgentConfig) {
    if (!config.accountPrivateKey) {
      throw new Error(
        'Starknet wallet private key is required https://www.argent.xyz/argent-x'
      );
    }
    if (config.aiModel !== 'ollama' && !config.aiProviderApiKey) {
      throw new Error('AI Provider API key is required');
    }
  }

  private async switchMode(newMode: string): Promise<string> {
    if (newMode === 'auto' && !this.agentconfig?.autonomous) {
      return 'Cannot switch to autonomous mode - not enabled in configuration';
    }

    if (this.currentMode === newMode) {
      return `Already in ${newMode} mode`;
    }

    this.currentMode = newMode;
    this.createAgentReactExecutor();
    return `Switched to ${newMode} mode`;
  }

  public async initializeTelegramManager(): Promise<void> {
    try {
      const bot_token = process.env.TELEGRAM_BOT_TOKEN;
      if (!bot_token) {
        throw new Error(`TELEGRAM_BOT_TOKEN is not set in your .env`);
      }
      const public_url = process.env.TELEGRAM_PUBLIC_URL;
      if (!public_url) {
        throw new Error(`TELEGRAM_PUBLIC_URL is not set in your .env`);
      }
      const bot_port: number = parseInt(
        process.env.TELEGRAM_BOT_PORT as string,
        10
      );
      if (isNaN(bot_port)) {
        throw new Error('TELEGRAM_BOT_PORT must be a valid number');
      }

      const bot = new TelegramBot(bot_token, {
        webHook: { port: bot_port },
      });
      if (!bot) {
        throw new Error(`Error trying to set your bot`);
      }

      const TelegramInterfaces: TelegramInterface = {
        bot_token: bot_token,
        public_url: public_url,
        bot_port: bot_port,
        bot: bot,
      };

      this.telegramAccountManager = TelegramInterfaces;
    } catch (error) {
      console.log(error);
      return;
    }
  }

  public async initializeTwitterManager(): Promise<void> {
    const auth_mode = process.env.TWITTER_AUTH_MODE;
    try {
      if (auth_mode === 'CREDENTIALS') {
        const username = process.env.TWITTER_USERNAME;
        const password = process.env.TWITTER_PASSWORD;
        const email = process.env.TWITTER_EMAIL;

        if (!username || !password) {
          throw new Error(
            'Error when try to initializeTwitterManager in CREDENTIALS twitter_auth_mode check your .env'
          );
        }
        const user_client = new Scraper();

        await user_client.login(username, password, email);
        const account = await user_client.me();
        if (!account) {
          throw new Error('Impossible to get your twitter account information');
        }
        const userClient: TwitterScraperConfig = {
          twitter_client: user_client,
          twitter_id: account?.userId as string,
          twitter_username: account?.username as string,
        };
        this.twitterAccoutManager.twitter_scraper = userClient;
      } else if (auth_mode === 'API') {
        const twitter_api = process.env.TWITTER_API;
        const twitter_api_secret = process.env.TWITTER_API_SECRET;
        const twitter_access_token = process.env.TWITTER_ACCESS_TOKEN;
        const twitter_access_token_secret =
          process.env.TWITTER_ACCESS_TOKEN_SECRET;

        if (
          !twitter_api ||
          !twitter_api_secret ||
          !twitter_access_token ||
          !twitter_access_token_secret
        ) {
          throw new Error(
            'Error when try to initializeTwitterManager in API twitter_auth_mode check your .env'
          );
        }

        const userClient = new TwitterApi({
          appKey: twitter_api,
          appSecret: twitter_api_secret,
          accessToken: twitter_access_token,
          accessSecret: twitter_access_token_secret,
        });
        if (!userClient) {
          throw new Error(
            'Error when trying to createn you Twitter API Account check your API Twitter CREDENTIALS'
          );
        }

        const apiConfig: TwitterApiConfig = {
          twitter_api: twitter_api,
          twitter_api_secret: twitter_api_secret,
          twitter_access_token: twitter_access_token,
          twitter_access_token_secret: twitter_access_token_secret,
          twitter_api_client: userClient,
        };

        this.twitterAccoutManager.twitter_api = apiConfig;
      } else {
        return;
      }
    } catch (error) {
      console.log(error);
      return;
    }
  }

  getAccountCredentials() {
    return {
      accountPrivateKey: this.accountPrivateKey,
      accountPublicKey: this.accountPublicKey,
    };
  }

  getModelCredentials() {
    return {
      aiModel: this.aiModel,
      aiProviderApiKey: this.aiProviderApiKey,
    };
  }

  getSignature() {
    return {
      signature: this.signature,
    };
  }

  getAgent() {
    return {
      agentMode: this.currentMode,
    };
  }

  getAgentConfig(): JsonConfig | undefined {
    return this.agentconfig;
  }

  getProvider(): RpcProvider {
    return this.provider;
  }

  getTwitterAuthMode(): 'API' | 'CREDENTIALS' | undefined {
    return process.env.TWITTER_AUTH_MODE as 'API' | 'CREDENTIALS' | undefined;
  }

  getTwitterManager(): TwitterInterface {
    if (!this.twitterAccoutManager) {
      throw new Error(
        'Twitter manager not initialized. Call initializeTwitterManager() first'
      );
    }
    return this.twitterAccoutManager;
  }

  getTelegramManager(): TelegramInterface {
    if (!this.telegramAccountManager) {
      throw new Error(
        'Telegram manager not initialized. Call initializeTwitterManager() first'
      );
    }
    return this.telegramAccountManager;
  }

  async validateRequest(request: string): Promise<boolean> {
    return Boolean(request && typeof request === 'string');
  }

  async execute(input: string): Promise<unknown> {
    if (input.toLowerCase().includes('switch to autonomous')) {
      return this.switchMode('auto');
    } else if (input.toLowerCase().includes('switch to interactive')) {
      return this.switchMode('agent');
    }

    if (this.currentMode !== 'agent') {
      throw new Error(`Can't use execute with agent_mode: ${this.currentMode}`);
    }

    const result = await this.agentReactExecutor.invoke({
      messages: input,
    });

    return result.messages[result.messages.length - 1].content;
  }

  async execute_autonomous(): Promise<unknown> {
    if (this.currentMode !== 'auto') {
      throw new Error(
        `Can't use execute_autonomous with agent_mode: ${this.currentMode}`
      );
    }

    while (true) {
      const result = await this.agentReactExecutor.agent.invoke(
        {
          messages: 'Choose what to do',
        },
        this.agentReactExecutor.agentConfig
      );

      console.log(result.messages[result.messages.length - 1].content);

      await new Promise((resolve) =>
        setTimeout(resolve, this.agentReactExecutor.json_config.interval)
      );
    }
  }

  async execute_call_data(input: string): Promise<unknown> {
    if (this.currentMode !== 'agent') {
      throw new Error(
        `Can't use execute call data with agent_mode: ${this.currentMode}`
      );
    }
    const aiMessage = await this.agentReactExecutor.invoke({ messages: input });
    try {
      const parsedResult = JSON.parse(
        aiMessage.messages[aiMessage.messages.length - 2].content
      );
      return parsedResult;
    } catch (parseError) {
      return {
        status: 'failure',
        error: `Failed to parse observation: ${parseError.message}`,
      };
    }
  }
}
