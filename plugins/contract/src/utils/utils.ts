
import { ExecuteV3Args } from '../types/types';


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
 * Creates a V3 transaction details payload with predefined gas parameters
 * @returns {Object} V3 transaction details payload with gas parameters
 */
export const getV3DetailsPayload = () => {
  return {
    version: 3,
    maxFee: 10n ** 16n,
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

