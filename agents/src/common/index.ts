import { RpcProvider } from 'starknet';
import { AgentConfig } from '../config/jsonConfig.js';

/**
 * Configuration for AI models used by agents
 */
export interface AiConfig {
  aiModel?: string;
  aiProvider?: string;
  aiProviderApiKey?: string;
  langchainVerbose?: boolean;
  maxInputTokens?: number;
  maxCompletionTokens?: number;
  maxTotalTokens?: number;
  modelSelector?: any; // Model selector instance - using any to avoid circular dependencies
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

  getProvider(): RpcProvider;

  getAgentConfig(): AgentConfig | undefined;

  getAgentMode(): string;
}
