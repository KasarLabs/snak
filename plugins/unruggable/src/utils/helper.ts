import { Account, CallData, RawArgs, Uint256 } from 'starknet';
import { FACTORY_ADDRESS } from '../constants';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { RpcProvider } from 'starknet';

/**
 * Execute a contract function transaction.
 *
 * ⚠️ WARNING: This function is only suitable for write operations where you don't need
 * the return value of the contract function. It only returns the transaction hash.
 *
 * For operations where you need the actual return value:
 * ```typescript
 * // Example of getting return value directly:
 * const account = new Account(rpcProvider, accountAddress, privateKey);
 * const contract = new Contract(abi, FACTORY_ADDRESS, account);
 * const result = await contract.yourFunctionName(your, params, here);
 * // Now you have access to the actual return value
 * ```
 *
 * @param method - The name of the contract function to call
 * @param publicKey - The caller's account address
 * @param privateKey - The caller's private key
 * @param calldata - The function arguments
 * @param provider - The RPC provider
 * @returns Transaction hash only
 */
export const execute = async (
  method: string,
  agent: StarknetAgentInterface,
  calldata: (string | Uint256)[],
  provider: RpcProvider
) => {
  const accountCredentials = agent.getAccountCredentials();
  const account = new Account(
    provider,
    accountCredentials.accountPublicKey,
    accountCredentials.accountPrivateKey
  );

  return await account.execute({
    contractAddress: FACTORY_ADDRESS,
    entrypoint: method,
    calldata: CallData.compile(calldata),
  });
};

/**
 * Creates a scaling factor string for token decimals by generating a "1" followed by N zeros.
 *
 * For example:
 * - decimalsScale(6) returns "1000000" (for tokens with 6 decimals like USDC)
 * - decimalsScale(18) returns "1000000000000000000" (for tokens with 18 decimals like ETH)
 *
 * Use cases:
 * - Converting human-readable amounts to token base units
 * - Scaling token amounts for contract interactions
 *
 * @param decimals - The number of decimal places the token uses
 * @returns A string representing 10^decimals (e.g., "1000000" for 6 decimals)
 *
 * @example
 * ```typescript
 * // For a token with 6 decimals (like USDC)
 * const scale = decimalsScale(6); // Returns "1000000"
 * const amount = (userInput * BigInt(scale)).toString(); // Convert 1.5 USDC to 1500000 base units
 *
 * // For a token with 18 decimals (like ETH)
 * const scale = decimalsScale(18); // Returns "1000000000000000000"
 * const amount = (userInput * BigInt(scale)).toString(); // Convert 1.5 ETH to 1500000000000000000 wei
 * ```
 */
export const decimalsScale = (decimals: number) =>
  `1${Array(decimals).fill('0').join('')}`;
