import { Account, BigNumberish, uint256 } from 'starknet';
import { tokenAddresses } from '../constants/erc20';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Configuration interface for transfer operations
 * @interface transferPayloads
 */
export interface transferPayloads {
  recipient_address: string;
  amount: string;
  symbol: string;
}

/**
 * Result interface for transfer operations
 * @interface TransferResult
 */
interface TransferResult {
  status: 'success' | 'failure';
  amount?: string;
  symbol?: string;
  recipients_address?: string;
  transaction_hash?: string;
  error?: string;
  step?: string;
}

/**
 * Formats token amount with correct decimals
 * @param {string} amount - Amount to format
 * @param {number} decimals - Number of decimals
 * @returns {string} Formatted amount
 */
const DECIMALS = {
  USDC: 6,
  USDT: 6,
  DEFAULT: 18,
};

/**
 * Formats amount to the correct decimal places for the token
 * @payload amount The amount as a string (e.g., "0.0001")
 * @payload decimals Number of decimal places
 * @returns Formatted amount as a string
 */
const formatTokenAmount = (amount: string, decimals: number): string => {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0');
  return whole + paddedFraction;
};

/**
 * Transfers ERC20 tokens on Starknet
 * @payload agent The agent performing the transfer
 * @payload payloads transfer payloadeters including recipient, amount, and token symbol
 * @returns Result of the transfer operation
 */
export const transfer = async (
  agent: StarknetAgentInterface,
  payloads: transferPayloads
): Promise<string> => {
  try {
    const credentials = agent.getAccountCredentials();
    const provider = agent.getProvider();

    const account = new Account(
      provider,
      credentials.accountPublicKey,
      credentials.accountPrivateKey
    );

    const tokenAddress = tokenAddresses[payloads.symbol];
    if (!tokenAddress) {
      throw new Error(`Token ${payloads.symbol} not supported`);
    }

    const decimals =
      DECIMALS[payloads.symbol as keyof typeof DECIMALS] || DECIMALS.DEFAULT;
    const formattedAmount = formatTokenAmount(payloads.amount, decimals);
    const amountUint256 = uint256.bnToUint256(formattedAmount);

    const result = await account.execute({
      contractAddress: tokenAddress,
      entrypoint: 'transfer',
      calldata: [
        payloads.recipient_address,
        amountUint256.low,
        amountUint256.high,
      ],
    });

    console.log(
      'transfer initiated. Transaction hash:',
      result.transaction_hash
    );

    await provider.waitForTransaction(result.transaction_hash);

    const transferResult: TransferResult = {
      status: 'success',
      amount: payloads.amount,
      symbol: payloads.symbol,
      recipients_address: payloads.recipient_address,
      transaction_hash: result.transaction_hash,
    };

    return JSON.stringify(transferResult);
  } catch (error) {
    console.error('transfer failed:', error);

    const transferResult: TransferResult = {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'transfer execution',
    };

    const result = JSON.stringify(transferResult);
    return result;
  }
};

/**
 * Schema for transfer payload parameters
 * @type {Object}
 */
export type TransferPlayloadSchema = {
  symbol: string;
  recipient_address: string;
  amount: string;
};

/**
 * Generates transfer signature for batch transfers
 * @param {Object} input - Transfer input
 * @param {TransferPlayloadSchema[]} input.payloads - Array of transfer parameters
 * @returns {Promise<string>} JSON string with transaction result
 */
export const transfer_signature = async (input: {
  payloads: TransferPlayloadSchema[];
}): Promise<any> => {
  try {
    const payloads = input.payloads;

    if (!Array.isArray(payloads)) {
      throw new Error('Payloads is not an Array');
    }

    const results = await Promise.all(
      payloads.map(async (payload) => {
        const tokenAddress = tokenAddresses[payload.symbol];
        if (!tokenAddress) {
          return {
            status: 'error',
            error: {
              code: 'TOKEN_NOT_SUPPORTED',
              message: `Token ${payload.symbol} not supported`,
            },
          };
        }
        const decimals =
          DECIMALS[payload.symbol as keyof typeof DECIMALS] || DECIMALS.DEFAULT;
        const formattedAmount = formatTokenAmount(payload.amount, decimals);
        const amountUint256 = uint256.bnToUint256(formattedAmount);

        return {
          status: 'success',
          transactions: {
            contractAddress: tokenAddress,
            entrypoint: 'transfer',
            calldata: [
              payload.recipient_address,
              amountUint256.low,
              amountUint256.high,
            ],
          },
        };
      })
    );
    console.log('Results :', results);
    return JSON.stringify({ transaction_type: 'INVOKE', results });
  } catch (error) {
    console.error('Transfer call data failure:', error);
    return {
      status: 'error',
      error: {
        code: 'TRANSFER_CALL_DATA_ERROR',
        message: error.message || 'Failed to generate transfer call data',
      },
    };
  }
};
