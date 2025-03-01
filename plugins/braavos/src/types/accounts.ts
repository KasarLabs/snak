import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ProviderInterface } from 'starknet';
/**
 * Details of a Starknet account
 * @property {string} address - The account's address
 * @property {string} privateKey - The account's private key
 * @property {string} publicKey - The account's public key
 * @property {boolean} deployStatus - Whether the account has been deployed
 */
export interface AccountDetails {
  contractAddress: string;
  publicKey: string;
  privateKey: string;
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
 * Representation of a token amount with precision
 * @property {string} amount - The token amount
 * @property {number} decimals - Number of decimal places
 */
export interface TokenAmount {
  amount: string;
  decimals: number;
}

/**
 * Structure for typed data signing
 * @property {Object} types - Map of type definitions
 * @property {TypeElement[]} [types.StarkNetDomain] - StarkNet domain type definition
 * @property {string} primaryType - The primary type to use
 * @property {StarkNetDomain} domain - The domain the typed data belongs to
 * @property {Record<string, unknown>} message - The structured data to sign
 */
export type TypedData = {
  types: {
    StarkNetDomain?: TypeElement[];
    [additionalProperties: string]: TypeElement[] | undefined;
  };
  primaryType: string;
  domain: StarkNetDomain;
  message: Record<string, unknown>;
};

/**
 * Element of a type definition
 * @property {string} name - Name of the type element
 * @property {string} type - Type of the element
 */
export type TypeElement = {
  name: string;
  type: string;
};

/**
 * StarkNet domain information
 * @property {string} name - Name of the domain
 * @property {string} version - Version of the domain
 * @property {string | number} chainId - Chain ID where the domain is valid
 */
export type StarkNetDomain = {
  name: string;
  version: string;
  chainId: string | number;
};

/**
 * Elliptic curve signature components
 * @property {string} r - The r component of the signature
 * @property {string} s - The s component of the signature
 * @property {number | null} [recoveryParam] - Optional recovery parameter
 */
export type WeierstrassSignatureType = {
  r: string;
  s: string;
  recoveryParam?: number | null;
};

/**
 * Response format for account creation operations
 * @property {('success'|'failure')} status - Status of the operation
 * @property {string} wallet - Type of wallet (Braavos, OKX, etc.)
 * @property {string} publicKey - The account's public key
 * @property {string} privateKey - The account's private key
 * @property {string} contractAddress - The account's contract address
 * @property {string} [error] - Error message if operation failed
 * @property {string} [message] - Formatted message for display
 */
export interface AccountResponse {
  status: 'success' | 'failure';
  wallet: string;
  publicKey?: string;
  privateKey?: string;
  contractAddress?: string;
  error?: string;
  message?: string;
  deployFee?: string;
  transaction_type?: string;
}
