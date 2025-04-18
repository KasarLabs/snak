import { Contract } from 'starknet';
import { StarknetAgentInterface } from '@kasarlabs/core';
import { INTERACT_ERC721_ABI } from '../abis/interact.js';
import { validateAndParseAddress } from 'starknet';
import { z } from 'zod';
import { getBalanceSchema, getOwnBalanceSchema } from '../schemas/schema.js';

/**
 * Gets ERC721 token balance
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof getBalanceSchema>} params - Balance check parameters
 * @returns {Promise<string>} JSON string with balance result
 */
export const getBalance = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getBalanceSchema>
): Promise<string> => {
  try {
    if (!params?.accountAddress || !params?.contractAddress) {
      throw new Error('Both account address and contract address are required');
    }

    const provider = agent.getProvider();

    const accountAddress = validateAndParseAddress(params.accountAddress);
    const contractAddress = validateAndParseAddress(params.contractAddress);

    const contract = new Contract(
      INTERACT_ERC721_ABI,
      contractAddress,
      provider
    );

    const balanceResponse = await contract.balanceOf(accountAddress);

    return JSON.stringify({
      status: 'success',
      balance: balanceResponse.toString(),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Gets own ERC721 token balance
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof getBalanceSchema>} params - Balance check parameters
 * @returns {Promise<string>} JSON string with balance result
 */
export const getOwnBalance = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getOwnBalanceSchema>
): Promise<string> => {
  try {
    if (!params?.contractAddress) {
      throw new Error('Contract address are required');
    }

    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const contractAddress = validateAndParseAddress(params.contractAddress);

    const contract = new Contract(
      INTERACT_ERC721_ABI,
      contractAddress,
      provider
    );

    const balanceResponse = await contract.balanceOf(
      accountCredentials.accountPublicKey
    );

    return JSON.stringify({
      status: 'success',
      balance: balanceResponse.toString(),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
