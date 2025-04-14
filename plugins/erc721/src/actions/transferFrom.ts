import { Account, Contract, constants } from 'starknet';
import { StarknetAgentInterface } from '@kasarlabs/agents';
import { INTERACT_ERC721_ABI } from '../abis/interact.js';
import {
  validateAndFormatTokenId,
  executeV3Transaction,
} from '../utils/utils.js';
import { validateAndParseAddress } from 'starknet';
import { z } from 'zod';
import { transferFromSchema, transferSchema } from '../schemas/schema.js';
import { TransactionResult } from '../types/types.js';

/**
 * Transfers a token from one address to another.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof transferFromSchema>} params - Transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const transferFrom = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof transferFromSchema>
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

    const calldata = contract.populate('transfer_from', [
      fromAddress,
      toAddress,
      tokenId,
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
      step: 'transfer execution',
    };
    return JSON.stringify(result);
  }
};

/**
 * Transfers a NFT to another address.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof transferSchema>} params - Transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const transfer = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof transferSchema>
): Promise<string> => {
  try {
    if (!params?.toAddress || !params?.tokenId || !params?.contractAddress) {
      throw new Error('To address, token ID and contract address are required');
    }

    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const toAddress = validateAndParseAddress(params.toAddress);
    const tokenId = validateAndFormatTokenId(params.tokenId);
    const contractAddress = validateAndParseAddress(params.contractAddress);

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

    const calldata = contract.populate('transfer_from', [
      accountCredentials.accountPublicKey,
      toAddress,
      tokenId,
    ]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });

    const result: TransactionResult = {
      status: 'success',
      tokenId: params.tokenId,
      from: accountCredentials.accountPublicKey,
      to: toAddress,
      transactionHash: txH,
    };

    return JSON.stringify(result);
  } catch (error) {
    const result: TransactionResult = {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'transfer execution',
    };
    return JSON.stringify(result);
  }
};

/**
 * Generate the call data for the transferFrom function.
 * @param params The parameters for the transferFrom function.
 * @returns A stringified JSON object with the transaction type and the call data.
 */
export const transferFromSignature = async (
  params: z.infer<typeof transferFromSchema>
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

    const result = {
      status: 'success',
      transactions: {
        contractAddress: contractAddress,
        entrypoint: 'transfer_from',
        calldata: [fromAddress, toAddress, tokenId.low, tokenId.high],
      },
    };

    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: {
        code: 'TRANSFER_FROM_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate transferFrom call data',
      },
    });
  }
};
