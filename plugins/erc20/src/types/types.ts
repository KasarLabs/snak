import { Uint256, Call, Account } from 'starknet';

/**
 * Token decimals configuration
 */
export const DECIMALS = {
  USDC: 6,
  USDT: 6,
  DEFAULT: 18,
};

/**
 * Transfer operation result
 * @property {('success'|'failure')} status
 * @property {string} [amount]
 * @property {string} [symbol]
 * @property {string} [recipients_address]
 * @property {string} [transaction_hash]
 * @property {string} [error]
 * @property {string} [step]
 */
export interface TransferResult {
  status: 'success' | 'failure';
  amount?: string;
  symbol?: string;
  recipients_address?: string;
  transaction_hash?: string;
  error?: string;
  step?: string;
}

/**
 * Validation result for a token
 * @property {string} address - Token address
 * @property {string} symbol - Token symbol
 * @property {number} decimals - Token decimals
 */
export interface validToken {
  address: string;
  symbol: string;
  decimals: number;
}

/**
 * Validation result for parameters
 * @property {string} address - Address
 * @property {Uint256} amount - Amount
 */
export interface ParamsValidationResult {
  address: string;
  amount: Uint256;
}

/**
 * V3 transaction execution arguments
 * @property {Call} call
 * @property {Account} account
 */
export interface ExecuteV3Args {
  call: Call;
  account: Account;
}

/**
 * Result of a contract deployment operation
 * @property {string} transactionHash - Transaction hash of the deployment
 * @property {string} contractAddress - Address of the deployed contract
 */
export interface ContractDeployResult {
  transactionHash: string | undefined;
  contractAddress: string | undefined;
}
