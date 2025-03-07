import { ProviderInterface } from 'starknet';

/**
 * Base class for utility functions
 * @property {ProviderInterface} provider - The Starknet provider instance
 */
export interface BaseUtilityClass {
  provider: ProviderInterface;
}

/**
 * Result of a contract deployment
 * @property {string} transactionHash - Hash of the deployment transaction
 * @property {string | string[]} contractAddress - Address(es) of the deployed contract(s)
 */
export interface ContractDeployResult {
  transactionHash: string;
  contractAddress: string | string[];
}

/**
 * Result of a transaction operation
 * @property {('success'|'failure')} status - Status of the transaction
 * @property {string} [transactionHash] - Hash of the executed transaction
 * @property {string} [error] - Error message if transaction failed
 */
export interface TransactionResult {
  status: 'success' | 'failure';
  transactionHash?: string;
  contractAddress?: string;
  error?: string;
}
