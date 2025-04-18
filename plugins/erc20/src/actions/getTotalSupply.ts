import { Contract } from 'starknet';
import { StarknetAgentInterface } from '@kasarlabs/core';
import { validateToken, formatBalance, detectAbiType } from '../utils/utils.js';
import { validToken } from '../types/types.js';
import { z } from 'zod';
import { getTotalSupplySchema } from '../schemas/schema.js';

/**
 * Gets the total supply of a token
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {GetTotalSupplyParams} params - Total supply parameters
 * @returns {Promise<string>} JSON string with total supply amount
 * @throws {Error} If operation fails
 */
export const getTotalSupply = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getTotalSupplySchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const token: validToken = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );
    const abi = await detectAbiType(token.address, provider);

    const tokenContract = new Contract(abi, token.address, provider);
    const totalSupply = await tokenContract.total_supply();

    const formattedSupply = formatBalance(totalSupply, token.decimals);

    return JSON.stringify({
      status: 'success',
      totalSupply: formattedSupply,
      symbol: token.symbol,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
