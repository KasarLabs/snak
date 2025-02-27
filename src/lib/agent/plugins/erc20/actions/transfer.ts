import { Account, constants, Contract } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { validateAndFormatParams, executeV3Transaction, validateToken } from '../utils/utils';
import { z } from 'zod';
import { transferSchema, transferSignatureSchema } from '../schemas/schema';
import { TransferResult } from '../types/types';
import { INTERACT_ERC20_ABI } from '../abis/interact';
import { validToken } from '../types/types';
import { RpcProvider } from 'starknet';

/**
 * Transfers ERC20 tokens on Starknet
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {TransferParams} params - Transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 * @throws {Error} If transfer fails
 */
export const transfer = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof transferSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const credentials = agent.getAccountCredentials();

    const token: validToken = await validateToken(
      provider,
      params.assetSymbol,
      params.assetAddress,
    );
    const { address, amount } = validateAndFormatParams(
      params.recipientAddress,
      params.amount,
      token.decimals
    );

    const recipientAddress = address;

    const account = new Account(
      provider,
      credentials.accountPublicKey,
      credentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contract = new Contract(
      INTERACT_ERC20_ABI,
      token.address,
      provider
    );
    contract.connect(account);

    const calldata = contract.populate('transfer', [
      recipientAddress,
      amount.low,
      amount.high,
    ]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });

    return JSON.stringify({
      status: 'success',
      amount: params.amount,
      symbol: token.symbol,
      recipients_address: recipientAddress,
      transaction_hash: txH,
    });
  } catch (error) {
    const transferResult: TransferResult = {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'transfer execution',
    };
    return JSON.stringify(transferResult);
  }
};

/**
 * Generates transfer signature
 * @param {Object} input - Transfer input
 * @param {TransferParams} input.params - Array of transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const transferSignature = async (
  params: z.infer<typeof transferSignatureSchema>
): Promise<any> => {
  try {
    const token = await validateToken(
      new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
      params.assetSymbol,
      params.assetAddress,
    );
    const { address, amount } = validateAndFormatParams(
      params.recipientAddress,
      params.amount,
      token.decimals
    );

    const recipientAddress = address;

    const result = {
      status: 'success',
      transactions: {
        contractAddress: token.address,
        entrypoint: 'transfer',
        calldata: [
          recipientAddress,
          amount.low,
          amount.high,
        ],
      },
      additional_data: {
        symbol: token.symbol,
        amount: params.amount,
        recipientAddress: recipientAddress,
      },
    };

    return JSON.stringify({ transaction_type: 'INVOKE', results: [result] });
  } catch (error) {
    return {
      status: 'error',
      error: {
        code: 'TRANSFER_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate transfer call data',
      },
    };
  }
};
