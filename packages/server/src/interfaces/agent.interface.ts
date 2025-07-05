import { RpcProvider } from 'starknet';

export interface IAgent {
  /**
   * Executes the user request.
   *
   * @param input - The request to execute.
   * @param isInterrupted - Indicates if the execution resumes an interrupted run.
   * @param config - Optional execution configuration.
   */
  execute(
    input: string,
    isInterrupted?: boolean,
    config?: Record<string, any>
  ): Promise<unknown> | AsyncGenerator<any>;

  /**
   * Returns the agent's Starknet account credentials.
   */
  getAccountCredentials(): {
    accountPrivateKey: string;
    accountPublicKey: string;
  };
}

export interface IExtendedAgent extends IAgent {
  /**
   * Returns the RPC provider the agent is using.
   */
  getProvider(): RpcProvider;
}
