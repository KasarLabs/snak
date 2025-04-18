import { Account, Contract, constants } from 'starknet';
import { StarknetAgentInterface } from '@snakagent/core';
import { INTERACT_ERC721_ABI } from '../abis/interact.js';
import {
  validateAndFormatTokenId,
  executeV3Transaction,
} from '../utils/utils.js';
import { z } from 'zod';
import { safeTransferFromSchema } from '../schemas/schema.js';
import { TransactionResult } from '../types/types.js';
import { validateAndParseAddress } from 'starknet';

/**
 * Safely transfers a token from one address to another.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof safeTransferFromSchema>} params - Safe transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const safeTransferFrom = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof safeTransferFromSchema>
): Promise<string> => {
  try {
    if (
      !params?.fromAddress ||
      !params?.toAddress ||
      !params?.tokenId ||
      !params?.contractAddress
    ) {
      throw new Error(
        'From address, to address, token ID and contract address are required'
      );
    }
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const fromAddress = validateAndParseAddress(params.fromAddress);
    const toAddress = validateAndParseAddress(params.toAddress);
    const tokenId = validateAndFormatTokenId(params.tokenId);
    const contractAddress = validateAndParseAddress(params.contractAddress);
    const data = ['0x0'];

    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contract = new Contract(
      INTERACT_ERC721_ABI,
      contractAddress,
      provider
    );
    contract.connect(account);

    const calldata = contract.populate('safe_transfer_from', [
      fromAddress,
      toAddress,
      tokenId,
      data,
    ]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });

    const result: TransactionResult = {
      status: 'success',
      tokenId: params.tokenId,
      from: fromAddress,
      to: toAddress,
      transactionHash: txH,
    };

    return JSON.stringify(result);
  } catch (error) {
    const result: TransactionResult = {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'safe transfer execution',
    };
    return JSON.stringify(result);
  }
};

/**
 * Safely transfers a token from one address to another.
 * @param {z.infer<typeof safeTransferFromSchema>} params - Safe transfer parameters
 * @returns {Promise<string>} JSON object with transaction result
 */
export const safeTransferFromSignature = async (
  params: z.infer<typeof safeTransferFromSchema>
): Promise<string> => {
  try {
    if (
      !params?.fromAddress ||
      !params?.toAddress ||
      !params?.tokenId ||
      !params?.contractAddress
    ) {
      throw new Error(
        'From address, to address, token ID and contract address are required'
      );
    }

    const fromAddress = validateAndParseAddress(params.fromAddress);
    const toAddress = validateAndParseAddress(params.toAddress);
    const tokenId = validateAndFormatTokenId(params.tokenId);
    const contractAddress = validateAndParseAddress(params.contractAddress);
    const data = '0x0';

    const result = {
      status: 'success',
      transactions: {
        contractAddress: contractAddress,
        entrypoint: 'safe_transfer_from',
        calldata: [fromAddress, toAddress, tokenId.low, tokenId.high, data],
      },
    };

    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: {
        code: 'SAFE_TRANSFER_FROM_CALL_DATA_ERROR',
        message:
          error.message || 'Failed to generate safeTransferFrom call data',
      },
    });
  }
};
