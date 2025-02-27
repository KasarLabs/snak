import { validateAndParseAddress, Account, Call, num, RPC } from 'starknet';
import { tokenAddresses } from '../constant/constant';
import { DECIMALS } from '../types/types';
import { uint256 } from 'starknet';
import { ParamsValidationResult, ExecuteV3Args } from '../types/types';

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
 * @param symbol - Token symbol
 * @returns Formatted balance as a string
 */
export const formatBalance = (
  rawBalance: bigint | string | number,
  symbol: string
): string => {
  try {
    const balanceStr =
      typeof rawBalance === 'bigint'
        ? rawBalance.toString()
        : String(rawBalance);

    if (!balanceStr || balanceStr === '0') {
      return '0';
    }

    const decimals = getTokenDecimals(symbol);

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
 * Validates and formats input parameters with strict validation
 * @param symbol - Token symbol
 * @param address - Starknet address
 * @param amount - Token amount
 * @returns Formatted parameters
 * @throws Error if validation fails
 */
export const validateAndFormatParams = (
  symbol: string,
  address: string,
  amount: string
): ParamsValidationResult => {
  try {
    if (!symbol) {
      throw new Error('Asset symbol is required');
    }
    const formattedSymbol = symbol.toUpperCase();

    const tokenAddress = validateTokenAddress(formattedSymbol);
    if (!tokenAddress) {
      throw new Error(`Token ${formattedSymbol} not supported`);
    }

    if (!address) {
      throw new Error('Address is required');
    }
    const formattedAddress = validateAndParseAddress(address);

    if (!amount) {
      throw new Error('Amount is required');
    }
    const decimals =
      DECIMALS[formattedSymbol as keyof typeof DECIMALS] || DECIMALS.DEFAULT;
    const formattedAmount = formatTokenAmount(amount, decimals);
    const formattedAmountUint256 = uint256.bnToUint256(formattedAmount);

    return {
      formattedSymbol,
      formattedAddress,
      formattedAmountUint256,
      tokenAddress,
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
  const maxL1Gas = 15000n;
  const maxL1GasPrice = 600000n * 10n ** 9n;
  
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
    }
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
  const { transaction_hash } = await account.execute(call, getV3DetailsPayload());

  const receipt = await account.waitForTransaction(transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error('Transaction confirmed but failed');
  }

  return transaction_hash;
};