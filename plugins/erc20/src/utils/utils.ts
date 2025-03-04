import {
  validateAndParseAddress,
  num,
  RPC,
  Contract,
  Provider,
  shortString,
} from 'starknet';
import { tokenAddresses } from '../constant/constant';
import { uint256 } from 'starknet';
import { ParamsValidationResult, ExecuteV3Args } from '../types/types';
import { DECIMALS } from '../types/types';
import { OLD_ERC20_ABI } from '../abis/old';
import { NEW_ERC20_ABI_MAINNET } from '../abis/new';
import { validToken } from '../types/types';

/**
 * Returns the number of decimals for a token
 * @param symbol - Token symbol
 * @returns Number of decimals
 */
export const getTokenDecimals = (symbol: string): number => {
  const stablecoinSymbols = ['USDC', 'USDT'];
  const decimals = stablecoinSymbols.includes(symbol.toUpperCase()) ? 6 : 18;
  return decimals;
};

/**
 * Formats a balance string to the correct decimal places
 * @param rawBalance - Raw balance as a string, number or bigint
 * @param decimals - Number of decimal places
 * @returns Formatted balance as a string
 */
export const formatBalance = (
  rawBalance: bigint | string | number,
  decimals: number
): string => {
  try {
    const balanceStr =
      typeof rawBalance === 'bigint'
        ? rawBalance.toString()
        : String(rawBalance);

    if (!balanceStr || balanceStr === '0') {
      return '0';
    }

    if (balanceStr.length <= decimals) {
      const zeros = '0'.repeat(decimals - balanceStr.length);
      const formattedBalance = `0.${zeros}${balanceStr}`;
      return formattedBalance;
    }

    const decimalPosition = balanceStr.length - decimals;
    const wholePart = balanceStr.slice(0, decimalPosition) || '0';
    const fractionalPart = balanceStr.slice(decimalPosition);
    const formattedBalance = `${wholePart}.${fractionalPart}`;

    return formattedBalance;
  } catch (error) {
    return '0';
  }
};

/**
 * Validates and formats an address
 * @param address - Starknet address
 * @returns Formatted address
 * @throws Error if validation fails
 */
export const validateTokenAddress = (symbol: string): string => {
  const tokenAddress = tokenAddresses[symbol];
  if (!tokenAddress) {
    throw new Error(
      `Token ${symbol} not supported. Available tokens: ${Object.keys(tokenAddresses).join(', ')}`
    );
  }
  return tokenAddress;
};

/**
 * Formats amount to the correct decimal places for the token
 * @payload amount The amount as a string (e.g., "0.0001")
 * @payload decimals Number of decimal places
 * @returns Formatted amount as a string
 */
export const formatTokenAmount = (amount: string, decimals: number): string => {
  const [whole, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0');
  return whole + paddedFraction;
};

/**
 * Validates and formats the address and amount parameters
 * @param address - Starknet address
 * @param amount - Amount to transfer
 * @param decimals - Number of decimal places
 * @returns Formatted address and amount
 * @throws Error if validation fails
 */
export const validateAndFormatParams = (
  address: string,
  amount: string,
  decimals: number
): ParamsValidationResult => {
  try {
    if (!address) {
      throw new Error('Address is required');
    }
    const formattedAddress = validateAndParseAddress(address);

    if (!amount) {
      throw new Error('Amount is required');
    }
    const formattedAmount = formatTokenAmount(amount, decimals);
    const formattedAmountUint256 = uint256.bnToUint256(formattedAmount);

    return {
      address: formattedAddress,
      amount: formattedAmountUint256,
    };
  } catch (error) {
    throw new Error(`Parameter validation failed: ${error.message}`);
  }
};

/**
 * Creates a V3 transaction details payload with predefined gas parameters
 * @returns {Object} V3 transaction details payload with gas parameters
 */
export const getV3DetailsPayload = () => {
  const maxL1Gas = 2000n;
  const maxL1GasPrice = 100000n * 10n ** 9n;

  return {
    version: 3,
    maxFee: 10n ** 16n,
    feeDataAvailabilityMode: RPC.EDataAvailabilityMode.L1,
    tip: 10n ** 14n,
    paymasterData: [],
    resourceBounds: {
      l1_gas: {
        max_amount: num.toHex(maxL1Gas),
        max_price_per_unit: num.toHex(maxL1GasPrice),
      },
      l2_gas: {
        max_amount: num.toHex(0n),
        max_price_per_unit: num.toHex(0n),
      },
    },
  };
};

/**
 * Executes a V3 transaction with preconfigured gas parameters
 * @param {ExecuteV3Args} args - Contains call and account
 * @returns {Promise<string>} Transaction hash
 * @throws {Error} If transaction fails
 */
export const executeV3Transaction = async ({
  call,
  account,
}: ExecuteV3Args): Promise<string> => {
  const { transaction_hash } = await account.execute(
    call,
    getV3DetailsPayload()
  );

  const receipt = await account.waitForTransaction(transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error('Transaction confirmed but failed');
  }

  return transaction_hash;
};

/**
 * Validates token by his symbol or address
 * @param {Provider} provider - The Starknet provider
 * @param {string} assetSymbol - The ERC20 token symbol
 * @param {string} assetAddress - The ERC20 token contract address
 * @returns {Promise<validToken>} The valid token
 * @throws {Error} If token is not valid
 */
export async function validateToken(
  provider: Provider,
  assetSymbol?: string,
  assetAddress?: string
): Promise<validToken> {
  if (!assetSymbol && !assetAddress) {
    throw new Error('Either asset symbol or asset address is required');
  }

  let address: string = '',
    symbol: string = '',
    decimals: number = 0;
  if (assetSymbol) {
    symbol = assetSymbol.toUpperCase();
    address = validateTokenAddress(symbol);
    if (!address) {
      throw new Error(`Token ${symbol} not supported`);
    }
    decimals = DECIMALS[symbol as keyof typeof DECIMALS] || DECIMALS.DEFAULT;
  } else if (assetAddress) {
    address = validateAndParseAddress(assetAddress);
    try {
      const abi = await detectAbiType(address, provider);
      const contract = new Contract(abi, address, provider);
      
      let rawSymbol = await contract.symbol();
      symbol = (abi == OLD_ERC20_ABI ? shortString.decodeShortString(rawSymbol) : rawSymbol.toUpperCase());

      const decimalsBigInt = await contract
      .decimals()
      .catch(() => DECIMALS.DEFAULT);
      decimals =
        typeof decimalsBigInt === 'bigint'
          ? Number(decimalsBigInt)
          : decimalsBigInt;
    } catch (error) {
      console.warn(`Error retrieving token info: ${error.message}`);
    }
  }
  return {
    address,
    symbol,
    decimals,
  };
}

/**
 * Detects the ABI type of a token contract
 * @param {string} address - The ERC20 token contract address
 * @param {Provider} provider - The Starknet provider
 * @returns {Promise<string>} The ABI type
 */
export async function detectAbiType(address : string, provider : Provider) {
  const contract = new Contract(OLD_ERC20_ABI, address, provider);
  const symbol = await contract.symbol();
  if (symbol == 0n) {
    return NEW_ERC20_ABI_MAINNET;
  }
  return OLD_ERC20_ABI;
}
