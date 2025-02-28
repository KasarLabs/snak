import { Account, Contract, constants, validateAndParseAddress } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC721_ABI } from '../abis/interact';
import { validateAndFormatTokenId, executeV3Transaction } from '../utils/utils';
import { z } from 'zod';
import { approveSchema } from '../schemas/schema';
import { TransactionResult } from '../types/types';

/**
 * Approves an address for NFT transfer
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof approveSchema>} params - Approval parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const approve = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof approveSchema>
): Promise<string> => {
  try {
    if (!params?.approvedAddress || !params?.tokenId || !params?.contractAddress) {
      throw new Error('Approved address, token ID and contract address are required');
    }
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const approvedAddress = validateAndParseAddress(params.approvedAddress);
    const contractAddress = validateAndParseAddress(params.contractAddress);
    const tokenId = validateAndFormatTokenId(params.tokenId);

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

    const calldata = contract.populate('approve', [
      approvedAddress,
      tokenId
    ]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });


    const result: TransactionResult = {
      status: 'success',
      tokenId: params.tokenId,
      approved: true,
      transactionHash: txH,
    };

    return JSON.stringify(result);
  } catch (error) {
    const result: TransactionResult = {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'approve execution',
    };
    return JSON.stringify(result);
  }
};

/**
 * Generates approval signature for NFT
 * @param {z.infer<typeof approveSchema>} params - Approval parameters
 * @returns {Promise<any>} Transaction signature data
 */
export const approveSignature = async (
  params: z.infer<typeof approveSchema>
): Promise<any> => {
  try {
    if (!params?.approvedAddress || !params?.tokenId || !params?.contractAddress) {
      throw new Error('Approved address, token ID and contract address are required');
    }

    const approvedAddress = validateAndParseAddress(params.approvedAddress);
    const tokenId = validateAndFormatTokenId(params.tokenId);
    const contractAddress = validateAndParseAddress(params.contractAddress);

    const result = {
      status: 'success',
      transactions: {
        contractAddress: contractAddress,
        entrypoint: 'approve',
        calldata: [
          approvedAddress,
          tokenId.low,
          tokenId.high
        ],
      },
    };

    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'APPROVE_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate approve call data',
      },
    };
  }
};
