import { Contract } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC20_ABI } from '../abis/interact';
import { validateToken, formatBalance } from '../utils/utils';
import { validToken } from '../types/types';
import { z } from 'zod';
import { getTotalSupplySchema } from '../schemas/schema';

/**
 * Gets the total supply of an ERC20 token.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {string} symbol - The ERC20 token contract address
 * @returns {Promise<string>} JSON string with total supply
 * @throws {Error} If operation fails
 */
export const getTotalSupply = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getTotalSupplySchema>
): Promise<string> => {
  try {
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
