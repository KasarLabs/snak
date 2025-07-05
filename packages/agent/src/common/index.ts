import { RpcProvider } from 'starknet';
import { AgentConfig } from '@snakagent/core';
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
   * Returns the agent's Starknet account credentials
   * @returns Starknet account credentials
   */
  getAccountCredentials(): {
    accountPrivateKey: string;
    accountPublicKey: string;
  };
}

export interface IExtendedAgent extends IAgent {
  /**
   * Returns the RPC provider for the agent.
   */
  getProvider(): RpcProvider;

  /**
   * Retrieves the agent configuration.
   */
  getAgentConfig(): AgentConfig;

  /**
   * Returns the agent's operating mode.
   */
  getAgentMode(): string;
}
