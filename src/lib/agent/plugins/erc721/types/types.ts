import { Call, Account } from 'starknet';

/**
 * Result of a transaction operation
 * @interface TransactionResult
 * @property {('success'|'failure')} status - Status of the transaction
 */
export interface TransactionResult {
  status: 'success' | 'failure';
  tokenId?: string;
  from?: string;
  to?: string;
  operator?: string;
  approved?: boolean;
  transactionHash?: string;
  error?: string;
  step?: string;
}

/**
 * V3 transaction execution arguments
 * @interface ExecuteV3Args
 * @property {Call} call - Call data for the transaction
 * @property {Account} account - Account executing the transaction
 */
export interface ExecuteV3Args {
  call: Call;
  account: Account;
}

/**
 * Result of contract declaration
 * @interface ContractDeclareResult
 * @property {string} [transactionHash] - Hash of the declaration transaction
 * @property {string} [classHash] - Class hash of the declared contract
 */
export interface ContractDeclareResult {
  transactionHash: string | undefined;
  classHash: string | undefined;
}

/**
 * Result of contract deployment
 * @interface ContractDeployResult
 * @property {string} [transactionHash] - Hash of the deployment transaction
 * @property {string} [contractAddress] - Address of the deployed contract
 */
export interface ContractDeployResult {
  transactionHash: string | undefined;
  contractAddress: string | undefined;
}

/**
 * Combined result of contract declaration and deployment
 * @interface ContractDeclareAndDeployResult
 * @property {ContractDeclareResult} declare - Result of the contract declaration
 * @property {ContractDeployResult} deploy - Result of the contract deployment
 */
export interface ContractDeclareAndDeployResult {
  declare: ContractDeclareResult;
  deploy: ContractDeployResult;
}