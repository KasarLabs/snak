import { Contract } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC20_ABI } from '../abis/interact';
import { formatBalance, validateTokenAddress } from '../utils/utils';
import { z } from 'zod';
import {
  getAllowanceSchema,
  getMyGivenAllowanceSchema,
  getAllowanceGivenToMeSchema,
} from '../schemas/schema';

/**
 * Gets the amount of tokens that a spender is allowed to spend on behalf of an owner.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {AllowanceParams} params - The owner, spender and token addresses
 * @returns {Promise<string>} JSON string with allowance amount
 * @throws {Error} If operation fails
 */
export const getAllowance = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getAllowanceSchema>
): Promise<string> => {
  try {
    if (!params?.assetSymbol) {
      throw new Error('Both asset symbol and account address are required');
    }
    const symbol = params.assetSymbol.toUpperCase();
    const tokenAddress = validateTokenAddress(symbol);

    const provider = agent.getProvider();
    const tokenContract = new Contract(INTERACT_ERC20_ABI, tokenAddress, provider);

    const allowanceResponse = await tokenContract.allowance(
      params.ownerAddress,
      params.spenderAddress
    );

    return JSON.stringify({
      status: 'success',
      owner: params.ownerAddress,
      spender: params.spenderAddress,
      allowance: formatBalance(allowanceResponse, symbol),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Gets allowances granted by the current user
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {MyGivenAllowanceParams} params - The spender and token addresses
 * @returns {Promise<string>} JSON string with allowance amount
 * @throws {Error} If operation fails
 */
export const getMyGivenAllowance = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getMyGivenAllowanceSchema>
): Promise<string> => {
  try {
    if (!params?.assetSymbol) {
      throw new Error('Both asset symbol and account address are required');
    }

    const symbol = params.assetSymbol.toUpperCase();
    const tokenAddress = validateTokenAddress(symbol);

    const provider = agent.getProvider();
    const ownerAddress = agent.getAccountCredentials().accountPublicKey;
    const tokenContract = new Contract(INTERACT_ERC20_ABI, tokenAddress, provider);

    const allowanceResponse = await tokenContract.allowance(
      ownerAddress,
      params.spenderAddress
    );

    return JSON.stringify({
      status: 'success',
      owner: ownerAddress,
      spender: params.spenderAddress,
      allowance: formatBalance(allowanceResponse, symbol),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Gets allowances granted to the current user
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {AllowanceGivenToMeParams} params - The owner and token addresses
 * @returns {Promise<string>} JSON string with allowance amount
 * @throws {Error} If operation fails
 */
export const getAllowanceGivenToMe = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getAllowanceGivenToMeSchema>
): Promise<string> => {
  try {
    if (!params?.assetSymbol) {
      throw new Error('Both asset symbol and account address are required');
    }

    const symbol = params.assetSymbol.toUpperCase();
    const tokenAddress = validateTokenAddress(symbol);

    const provider = agent.getProvider();
    const spenderAddress = agent.getAccountCredentials().accountPublicKey;
    const tokenContract = new Contract(INTERACT_ERC20_ABI, tokenAddress, provider);

    const allowanceResponse = await tokenContract.allowance(
      params.ownerAddress,
      spenderAddress
    );

    return JSON.stringify({
      status: 'success',
      owner: params.ownerAddress,
      spender: spenderAddress,
      allowance: formatBalance(allowanceResponse, symbol),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
