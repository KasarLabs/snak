import { Account, Contract, RpcProvider } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC20_ABI } from '../abis/interact';
import { formatBalance, validateToken } from '../utils/utils';
import { validToken } from '../types/types';
import { z } from 'zod';
import { getBalanceSchema, getOwnBalanceSchema } from '../schemas/schema';

/**
 * Gets own token balance
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {OwnBalanceParams} params - Balance parameters
 * @returns {Promise<string>} JSON string with balance amount
 * @throws {Error} If operation fails
 */
export const getOwnBalance = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getOwnBalanceSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const accountAddress = accountCredentials?.accountPublicKey;
    const accountPrivateKey = accountCredentials?.accountPrivateKey;

    const token: validToken = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );

    if (!accountAddress) {
      throw new Error('Wallet address not configured');
    }

    const account = new Account(provider, accountAddress, accountPrivateKey);
    const tokenContract = new Contract(
      INTERACT_ERC20_ABI,
      token.address,
      provider
    );

    const balanceResponse = await tokenContract.balanceOf(account.address);

    if (balanceResponse === undefined || balanceResponse === null) {
      throw new Error('No balance value received from contract');
    }

    const formattedBalance = formatBalance(balanceResponse, token.decimals);

    return JSON.stringify({
      status: 'success',
      balance: formattedBalance,
      symbol: token.symbol,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Gets token balance for an address
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {BalanceParams} params - Balance parameters
 * @returns {Promise<string>} JSON string with balance amount
 * @throws {Error} If operation fails
 */
export const getBalance = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getBalanceSchema>
): Promise<string> => {
  try {
    if (!params?.accountAddress) {
      throw new Error('Account address are required');
    }
    const token: validToken = await validateToken(
      agent.getProvider(),
      params.assetSymbol,
      params.assetAddress
    );

    const provider = agent.getProvider();
    const tokenContract = new Contract(
      INTERACT_ERC20_ABI,
      token.address,
      provider
    );
    const balanceResponse = await tokenContract.balanceOf(
      params.accountAddress
    );

    const balanceValue =
      typeof balanceResponse === 'object' && 'balance' in balanceResponse
        ? balanceResponse.balance
        : balanceResponse;

    const formattedBalance = formatBalance(balanceValue, token.decimals);

    return JSON.stringify({
      status: 'success',
      balance: formattedBalance,
      symbol: token.symbol,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
