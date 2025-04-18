import { Account, Contract, RpcProvider, constants } from 'starknet';
import { StarknetAgentInterface } from '@snakagent/core';
import {
  validateAndFormatParams,
  executeV3Transaction,
  validateToken,
  detectAbiType,
} from '../utils/utils.js';
import { z } from 'zod';
import { approveSchema, approveSignatureSchema } from '../schemas/schema.js';
import { validToken } from '../types/types.js';

/**
 * Approves token spending
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {ApproveParams} params - Approval parameters
 * @returns {Promise<string>} JSON string with transaction result
 * @throws {Error} If approval fails
 */
export const approve = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof approveSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const token = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );
    const abi = await detectAbiType(token.address, provider);
    const { address, amount } = validateAndFormatParams(
      params.spenderAddress,
      params.amount,
      token.decimals
    );

    const spenderAddress = address;

    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contract = new Contract(abi, token.address, provider);
    contract.connect(account);

    const calldata = contract.populate('approve', [spenderAddress, amount]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });

    return JSON.stringify({
      status: 'success',
      amount: params.amount,
      symbol: token.symbol,
      spender_address: spenderAddress,
      transactionHash: txH,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'transfer execution',
    });
  }
};

/**
 * Generates approve signature
 * @param {Object} input - Approve input
 * @param {ApproveParams[]} input.params - Array of approve parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const approveSignature = async (
  params: z.infer<typeof approveSignatureSchema>
): Promise<string> => {
  try {
    const token: validToken = await validateToken(
      new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
      params.assetSymbol,
      params.assetAddress
    );
    const { address, amount } = validateAndFormatParams(
      params.spenderAddress,
      params.amount,
      token.decimals
    );

    const spenderAddress = address;

    const result = {
      status: 'success',
      transactions: {
        contractAddress: token.address,
        entrypoint: 'approve',
        calldata: [spenderAddress, amount.low, amount.high],
      },
      additional_data: {
        symbol: token.symbol,
        amount: params.amount,
        spenderAddress: spenderAddress,
      },
    };

    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: {
        code: 'APPROVE_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate approve call data',
      },
    });
  }
};
