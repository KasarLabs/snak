import { RpcProvider } from 'starknet';
import { TwitterApi } from 'twitter-api-v2';
import { Scraper } from 'agent-twitter-client';
import TelegramBot from 'node-telegram-bot-api';

/**
 * AI service configuration
 * @property {string} apiKey - API key for the AI service
 * @property {string} aiModel - Model identifier to use
 * @property {string} aiProvider - Name of the AI service provider
 */
export type AiConfig = {
  aiProviderApiKey: string;
  aiModel: string;
  aiProvider: string;
};

/**
 * Configuration for Twitter API authentication and client setup
 * @interface TwitterApiConfig
 * @param {string} twitter_api - The Twitter API key for authentication
 * @param {string} twitter_api_secret - The Twitter API secret key
 * @param {string} twitter_access_token - OAuth access token
 * @param {string} twitter_access_token_secret - OAuth access token secret
 * @param {TwitterApi} twitter_api_client - Initialized Twitter API client instance
 */
export interface TwitterApiConfig {
  twitter_api: string;
  twitter_api_secret: string;
  twitter_access_token: string;
  twitter_access_token_secret: string;
  twitter_api_client: TwitterApi;
}

/**
 * Configuration for Twitter scraping functionality
 * @interface TwitterScraperConfig
 * @param {Scraper} twitter_client - The Twitter scraper client instance
 * @param {string} twitter_id - Unique identifier of the Twitter account
 * @param {string} twitter_username - Username of the Twitter account
 */
export interface TwitterScraperConfig {
  twitter_client: Scraper;
  twitter_id: string;
  twitter_username: string;
}

/**
 * Main Twitter interface combining API and Scraper configurations
 * @interface TwitterInterface
 * @param {TwitterScraperConfig} [twitter_scraper] - Optional scraper configuration
 * @param {TwitterApiConfig} [twitter_api] - Optional API configuration
 */
export interface TwitterInterface {
  twitter_scraper?: TwitterScraperConfig;
  twitter_api?: TwitterApiConfig;
}

/**
 * Telegram Interface.
 *
 * @param {string} bot_token - Telegram bot authentication token
 * @param {string} public_url - Public URL for the webhook
 * @param {string} bot_port - Port number for the server to listen on
 * @param {TelegramBot} bot - Telegram bot instance
 */

export interface TelegramInterface {
  bot_token?: string;
  public_url?: string;
  bot_port?: number;
  bot?: TelegramBot;
}

export interface IAgent {
  /**
   * Executes the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute(input: string): Promise<unknown>;

  /**
   * Executes the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute_call_data(input: string): Promise<unknown>;

  /**
   * Executes agent autonomous the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute_autonomous(): Promise<unknown>;

  /**
   * Validates the user request before execution
   * @param request The user's request string
   * @returns Promise<boolean> indicating if request is valid
   * @throws AgentValidationError if validation fails
   */
  validateRequest(request: string): Promise<boolean>;

  /**
   * Returns the agent's Starknet account credentials
   * @returns Starknet account credentials
   */
  getAccountCredentials(): {
    accountPrivateKey: string;
    accountPublicKey: string;
  };

  /**
   * Returns the agent's AI provider credentials
   * @returns AI provider credentials
   */
  getModelCredentials(): {
    aiModel: string;
    aiProviderApiKey: string;
  };

  getProvider(): RpcProvider;
}
