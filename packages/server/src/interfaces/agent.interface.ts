import { RpcProvider } from 'starknet';

export interface IAgent {

  execute(
    input: string,
    config?: Record<string, any>
  ): Promise<unknown> | AsyncGenerator<any>;

  /**
   * Returns the agent's Starknet account credentials
   * @returns Starknet account credentials
   */
  getAccountCredentials(): {
    accountPrivateKey: string;
    accountPublicKey: string;
  };

  getProvider(): RpcProvider;
}
