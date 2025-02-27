import {
  Account,
  Contract,
  validateAndParseAddress,
  constants,
} from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC20_ABI } from '../abis/interact';
import { validateAndFormatParams, executeV3Transaction } from '../utils/utils';
import { z } from 'zod';
import {
  transferFromSchema,
  transferFromSignatureSchema,
} from '../schemas/schema';

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
    const validatedParams = validateAndFormatParams(
      params.assetSymbol,
      params.fromAddress,
      params.amount
    );

    const fromAddress = validatedParams.formattedAddress;
    const toAddress = validateAndParseAddress(params.toAddress);
    const credentials = agent.getAccountCredentials();
    const provider = agent.getProvider();

    const account = new Account(
      provider,
      credentials.accountPublicKey,
      credentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contract = new Contract(
      INTERACT_ERC20_ABI,
      validatedParams.tokenAddress,
      provider
    );

    contract.connect(account);

    const calldata = contract.populate('transfer_from', [
      fromAddress,
      toAddress,
      validatedParams.formattedAmountUint256,
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
 * Generates transfer signature for batch transfers
 * @param {Object} input - Transfer input
 * @param {TransferFromParams} params - Array of transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const transferFromSignature = async (
  params: z.infer<typeof transferFromSignatureSchema>
): Promise<any> => {
  try {
    const validatedParams = validateAndFormatParams(
      params.assetSymbol,
      params.fromAddress,
      params.amount
    );

    const fromAddress = validatedParams.formattedAddress;
    const toAddress = validateAndParseAddress(params.toAddress);

    const result = {
      status: 'success',
      transactions: {
        contractAddress: validatedParams.tokenAddress,
        entrypoint: 'transfer_from',
        calldata: [
          fromAddress,
          toAddress,
          validatedParams.formattedAmountUint256.low,
          validatedParams.formattedAmountUint256.high,
        ],
      },
      additional_data: {
        symbol: params.assetSymbol,
        amount: params.amount,
        spenderAddress: fromAddress,
        recipientAddress: toAddress,
      },
    };
    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'TRANSFERFROM_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate transferFrom call data',
      },
    };
  }
};
