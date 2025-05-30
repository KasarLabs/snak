import { Contract } from 'starknet';
import { SnakAgentInterface } from '@snakagent/core';
import { formatBalance, validateToken, detectAbiType } from '../utils/utils.js';
import { z } from 'zod';
import {
  getAllowanceSchema,
  getMyGivenAllowanceSchema,
  getAllowanceGivenToMeSchema,
} from '../schemas/schema.js';

/**
 * Gets the amount of tokens that a spender is allowed to spend on behalf of an owner.
 * @param {SnakAgentInterface} agent - The Starknet agent interface
 * @param {AllowanceParams} params - The owner, spender and token addresses
 * @returns {Promise<string>} JSON string with allowance amount
 * @throws {Error} If operation fails
 */
export const getAllowance = async (
  agent: SnakAgentInterface,
  params: z.infer<typeof getAllowanceSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();

    const token = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );
    const abi = await detectAbiType(token.address, provider);

    const tokenContract = new Contract(abi, token.address, provider);

    const allowanceResponse = await tokenContract.allowance(
      params.ownerAddress,
      params.spenderAddress
    );

    return JSON.stringify({
      status: 'success',
      owner: params.ownerAddress,
      spender: params.spenderAddress,
      allowance: formatBalance(allowanceResponse, token.decimals),
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
 * Gets allowances granted by the current user
 * @param {SnakAgentInterface} agent - The Starknet agent interface
 * @param {MyGivenAllowanceParams} params - The spender and token addresses
 * @returns {Promise<string>} JSON string with allowance amount
 * @throws {Error} If operation fails
 */
export const getMyGivenAllowance = async (
  agent: SnakAgentInterface,
  params: z.infer<typeof getMyGivenAllowanceSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const ownerAddress = agent.getAccountCredentials().accountPublicKey;

    const token = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );
    const abi = await detectAbiType(token.address, provider);

    const tokenContract = new Contract(abi, token.address, provider);

    const allowanceResponse = await tokenContract.allowance(
      ownerAddress,
      params.spenderAddress
    );

    return JSON.stringify({
      status: 'success',
      owner: ownerAddress,
      spender: params.spenderAddress,
      allowance: formatBalance(allowanceResponse, token.decimals),
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
 * Gets allowances granted to the current user
 * @param {SnakAgentInterface} agent - The Starknet agent interface
 * @param {AllowanceGivenToMeParams} params - The owner and token addresses
 * @returns {Promise<string>} JSON string with allowance amount
 * @throws {Error} If operation fails
 */
export const getAllowanceGivenToMe = async (
  agent: SnakAgentInterface,
  params: z.infer<typeof getAllowanceGivenToMeSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const spenderAddress = agent.getAccountCredentials().accountPublicKey;

    const token = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );
    const abi = await detectAbiType(token.address, provider);

    const tokenContract = new Contract(abi, token.address, provider);

    const allowanceResponse = await tokenContract.allowance(
      params.ownerAddress,
      spenderAddress
    );

    return JSON.stringify({
      status: 'success',
      owner: params.ownerAddress,
      spender: spenderAddress,
      allowance: formatBalance(allowanceResponse, token.decimals),
      symbol: token.symbol,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
