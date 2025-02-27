import { Account, Contract, constants } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC20_ABI } from '../abis/interact';
import { validateAndFormatParams, executeV3Transaction } from '../utils/utils';
import { z } from 'zod';
import { approveSchema, approveSignatureSchema } from '../schemas/schema';

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
    const validatedParams = validateAndFormatParams(
      params.assetSymbol,
      params.spenderAddress,
      params.amount
    );

    const spenderAddress = validatedParams.formattedAddress;
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contract = new Contract(
      INTERACT_ERC20_ABI,
      validatedParams.tokenAddress,
      provider
    );
    contract.connect(account);

    const calldata = contract.populate('approve', [
      spenderAddress,
      validatedParams.formattedAmountUint256,
    ]);

    const txH = await executeV3Transaction({
      call: calldata,
      account: account,
    });

    return JSON.stringify({
      status: 'success',
      amount: params.amount,
      symbol: validatedParams.formattedSymbol,
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
 * Generates approve signature for batch approvals
 * @param {Object} input - Approve input
 * @param {ApproveParams[]} input.params - Array of approve parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const approveSignature = async (
  params: z.infer<typeof approveSignatureSchema>
): Promise<any> => {
  try {
    const validatedParams = validateAndFormatParams(
      params.assetSymbol,
      params.spenderAddress,
      params.amount
    );

    const spenderAddress = validatedParams.formattedAddress;

    const result = {
      status: 'success',
      transactions: {
        contractAddress: validatedParams.tokenAddress,
        entrypoint: 'approve',
        calldata: [
          spenderAddress,
          validatedParams.formattedAmountUint256.low,
          validatedParams.formattedAmountUint256.high,
        ],
      },
      additional_data: {
        symbol: params.assetSymbol,
        amount: params.amount,
        spenderAddress: spenderAddress,
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
