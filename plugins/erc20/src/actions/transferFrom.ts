import {
  Account,
  Contract,
  validateAndParseAddress,
  constants,
} from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import {
  validateAndFormatParams,
  executeV3Transaction,
  validateToken,
  detectAbiType
} from '../utils/utils';
import { z } from 'zod';
import {
  transferFromSchema,
  transferFromSignatureSchema,
} from '../schemas/schema';
import { validToken } from '../types/types';
import { RpcProvider } from 'starknet';
import { StringSelectMenuBuilder } from 'discord.js';

/**
 * Transfers tokens from one address to another using an allowance.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {TransferFromParams} params - Transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 * @throws {Error} If transfer fails
 */
export const transferFrom = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof transferFromSchema>
): Promise<string> => {
  try {
    const credentials = agent.getAccountCredentials();
    const provider = agent.getProvider();

    const token = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress
    );
    const abi = await detectAbiType(token.address, provider);
    const { address, amount } = validateAndFormatParams(
      params.fromAddress,
      params.amount,
      token.decimals
    );

    const fromAddress = address;
    const toAddress = validateAndParseAddress(params.toAddress);

    const account = new Account(
      provider,
      credentials.accountPublicKey,
      credentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contract = new Contract(abi, token.address, provider);

    contract.connect(account);

    const calldata = contract.populate('transfer_from', [
      fromAddress,
      toAddress,
      amount,
    ]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });

    return JSON.stringify({
      status: 'success',
      transactionHash: txH,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Generates transferFrom signature
 * @param {Object} input - Transfer input
 * @param {TransferFromParams} params - Array of transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const transferFromSignature = async (
  params: z.infer<typeof transferFromSignatureSchema>
): Promise<string> => {
  try {
    const token = await validateToken(
      new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
      params.assetSymbol,
      params.assetAddress
    );
    const { address, amount } = validateAndFormatParams(
      params.fromAddress,
      params.amount,
      token.decimals
    );

    const fromAddress = address;
    const toAddress = validateAndParseAddress(params.toAddress);

    const result = {
      status: 'success',
      transactions: {
        contractAddress: token.address,
        entrypoint: 'transfer_from',
        calldata: [fromAddress, toAddress, amount.low, amount.high],
      },
      additional_data: {
        symbol: token.symbol,
        amount: params.amount,
        spenderAddress: fromAddress,
        recipientAddress: toAddress,
      },
    };
    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: {
        code: 'TRANSFERFROM_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate transferFrom call data',
      },
    });
  }
};
