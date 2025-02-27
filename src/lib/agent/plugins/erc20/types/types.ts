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
 * Validated parameters for token operations
 * @property {string} formattedSymbol
 * @property {string} formattedAddress
 * @property {string} tokenAddress
 * @property {Uint256} formattedAmountUint256
 */
export interface ParamsValidationResult {
  formattedSymbol: string;
  formattedAddress: string;
  tokenAddress: string;
  formattedAmountUint256: Uint256;
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
 * Result of a contract declaration operation
 * @property {string} transactionHash - Transaction hash of the declaration
 * @property {string} classHash - Class hash of the declared contract
 */
export interface ContractDeclareResult {
  transactionHash: string | undefined;
  classHash: string | undefined;
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

/**
 * Combined result of contract declaration and deployment
 * @property {ContractDeclareResult} declare - Declaration result
 * @property {ContractDeployResult} deploy - Deployment result
 */
export interface ContractDeclareAndDeployResult {
  declare: ContractDeclareResult;
  deploy: ContractDeployResult;
}