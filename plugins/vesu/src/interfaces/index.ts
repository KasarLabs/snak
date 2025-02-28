import { z } from 'zod';
import { Hex, hexSchemaBase } from '../utils/num';
import { validateChecksumAddress } from 'starknet';

export type Address = `0x${string}`;

export const addressSchema = hexSchemaBase
  .min(50, 'Address must be at least 50 characters long')
  .max(66, 'Address must be at most 66 characters long')
  .refine((value) => {
    // if it contains uppercase letters, it must match the checksum
    if (/[A-F]/.test(value)) {
      return validateChecksumAddress(value);
    }
    // if it only contains lowercase letters, it's valid
    return true;
  }, 'Address is not a valid checksum address')
  .transform<Address>((value) => {
    // remove 0x prefix
    const withoutPrefix = value.startsWith('0x') ? value.slice(2) : value;
    // pad left until length is 64
    const padded = withoutPrefix.padStart(64, '0');
    // add 0x prefix
    return `0x${padded}`;
  })
  .or(z.literal('0x0'));

/**
 * Represents a token value with its decimal precision
 * @interface ITokenValue
 * @property {bigint} value - The token amount
 * @property {number} decimals - Number of decimal places
 */
export interface ITokenValue {
  value: bigint;
  decimals: number;
}

/**
 * Base token information
 * @interface IBaseToken
 * @property {string} name - Token name
 * @property {Hex} address - Token contract address
 * @property {string} symbol - Token symbol
 * @property {number} decimals - Token decimal places
 * @property {ITokenValue} [usdPrice] - Optional USD price information
 */
export interface IBaseToken {
  name: string;
  address: Hex;
  symbol: string;
  decimals: number;
  usdPrice?: ITokenValue;
}

/**
 * Represents a pair of pool assets
 * @interface IPoolAssetPair
 * @property {Hex} collateralAssetAddress - Address of collateral asset
 * @property {Hex} debtAssetAddress - Address of debt asset
 * @property {ITokenValue} maxLTV - Maximum loan-to-value ratio
 */
export interface IPoolAssetPair {
  collateralAssetAddress: Hex;
  debtAssetAddress: Hex;
  maxLTV: ITokenValue;
}

/**
 * Extended token information with pool-specific data
 * @interface IPoolAsset
 * @extends IBaseToken
 * @property {IBaseToken} vToken - Associated vToken information
 * @property {number} listedBlockNumber - Block number when asset was listed
 * @property {Object} config - Asset configuration
 * @property {ITokenValue} interestRate - Current interest rate
 * @property {Object} stats - Asset statistics
 */
export interface IPoolAsset extends IBaseToken {
  vToken: IBaseToken;
  listedBlockNumber: number;
  config: {
    debtFloor: ITokenValue;
    isLegacy: boolean;
    feeRate: ITokenValue;
    lastFullUtilizationRate: ITokenValue;
    lastRateAccumulator: ITokenValue;
    lastUpdated: Date;
    maxUtilization: ITokenValue;
    reserve: ITokenValue;
    totalCollateralShares: ITokenValue;
    totalNominalDebt: ITokenValue;
  };
  interestRate: ITokenValue;
  stats: {
    totalSupplied: ITokenValue;
    totalDebt: ITokenValue;
    currentUtilization: ITokenValue;
    supplyApy: ITokenValue;
    defiSpringSupplyApr: ITokenValue | null;
    lstApr: ITokenValue | null;
    borrowApr: ITokenValue;
  };
}

/**
 * Pool information and configuration
 * @interface IPool
 * @property {string} id - Pool identifier
 * @property {string} name - Pool name
 * @property {Hex} owner - Pool owner address
 * @property {Hex} extensionContractAddress - Address of pool extension contract
 * @property {boolean} isVerified - Pool verification status
 * @property {IPoolAsset[]} assets - Pool assets
 * @property {Object} [stats] - Optional pool statistics
 * @property {IPoolAssetPair[]} [pairs] - Optional asset pairs configuration
 */
export interface IPool {
  id: string;
  name: string;
  owner: Hex;
  // shutdownStatus: PoolShutdownStatus
  extensionContractAddress: Hex;
  isVerified: boolean;
  assets: IPoolAsset[];
  stats?: {
    usdTotalSupplied: ITokenValue;
    usdTotalBorrowed: ITokenValue;
  };
  pairs?: IPoolAssetPair[];
}

/**
 * Pool data validation schema
 * @constant {z.ZodType}
 */
export const poolParser = z.object({
  id: z.string(),
  name: z.string(),
  owner: addressSchema,
  extensionContractAddress: addressSchema,
  isVerified: z.boolean(),
  assets: z.any(),
  pairs: z.any(),
  // assets: z.array(poolAssetParser),
  // pairs: z.array(poolPairParser),
});

/**
 * Parameters for deposit operations
 * @interface DepositParams
 * @property {string} depositTokenSymbol - Symbol of token to deposit
 * @property {string} depositAmount - Amount to deposit
 */
export interface DepositParams {
  depositTokenSymbol: string;
  depositAmount: string;
}

/**
 * Parameters for withdrawal operations
 * @interface WithdrawParams
 * @property {string} withdrawTokenSymbol - Symbol of token to withdraw
 */
export interface WithdrawParams {
  withdrawTokenSymbol: string;
}

/**
 * Represents a decimal number with precision
 * @interface BigDecimal
 * @property {bigint} value - The numeric value
 * @property {number} decimals - Number of decimal places
 */
export interface BigDecimal {
  value: bigint;
  decimals: number;
}

/**
 * Result of a deposit operation
 * @interface DepositResult
 * @property {'success' | 'failure'} status - Operation status
 * @property {string} [amount] - Amount deposited
 * @property {string} [symbol] - Token symbol
 * @property {string} [recipients_address] - Recipient address
 * @property {string} [transaction_hash] - Transaction hash
 * @property {string} [error] - Error message if failed
 * @property {string} [step] - Current step in process
 */
export interface DepositResult {
  status: 'success' | 'failure';
  amount?: string;
  symbol?: string;
  recipients_address?: string;
  transaction_hash?: string;
  error?: string;
  step?: string;
}

/**
 * Result of a withdrawal operation
 * @interface WithdrawResult
 * @property {'success' | 'failure'} status - Operation status
 * @property {string} [symbol] - Token symbol
 * @property {string} [recipients_address] - Recipient address
 * @property {string} [transaction_hash] - Transaction hash
 * @property {string} [error] - Error message if failed
 * @property {string} [step] - Current step in process
 */
export interface WithdrawResult {
  status: 'success' | 'failure';
  symbol?: string;
  recipients_address?: string;
  transaction_hash?: string;
  error?: string;
  step?: string;
}
