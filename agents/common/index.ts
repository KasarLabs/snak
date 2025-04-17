import { RpcProvider } from 'starknet';
import { JsonConfig } from '../src/jsonConfig.js';

/**
 * AI service configuration
 * @property {string} apiKey - API key for the AI service
 * @property {string} aiModel - Model identifier to use
 * @property {string} aiProvider - Name of the AI service provider
 * @property {boolean} langchainVerbose - Whether to enable verbose logging for LangChain
 * @property {number} maxInputTokens - Maximum number of input tokens allowed
 * @property {number} maxCompletionTokens - Maximum number of completion tokens allowed
 * @property {number} maxTotalTokens - Maximum number of total tokens allowed
 */
export type AiConfig = {
  aiProviderApiKey: string;
  aiModel: string;
  aiProvider: string;
  langchainVerbose?: boolean;
  maxInputTokens?: number;
  maxCompletionTokens?: number;
  maxTotalTokens?: number;
};

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
   * Returns the agent's base AI provider configuration details
   * @returns Base AI provider details (model name and provider)
   */
  getModelCredentials(): {
    aiModel: string;
    aiProvider: string;
  };

  getProvider(): RpcProvider;

  getAgentConfig(): JsonConfig | undefined;

  getAgentMode(): string;
}
