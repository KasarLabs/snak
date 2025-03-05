import { Contract } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { validateToken, formatBalance, detectAbiType } from '../utils/utils.js';
import { validToken } from '../types/types.js';
import { z } from 'zod';
import { getTotalSupplySchema } from '../schemas/schema.js';

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
