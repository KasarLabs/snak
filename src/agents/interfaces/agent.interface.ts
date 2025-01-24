import { RpcProvider } from 'starknet';

export interface IAgent {
  /**
   * Executes the user request and returns the result
   * @param input The user's request string
   * @returns Promise resolving to the execution result
   * @throws AgentExecutionError if execution fails
   */
  execute(input: string, call_data_function: boolean): Promise<unknown>;

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
