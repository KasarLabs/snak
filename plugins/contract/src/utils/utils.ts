import { ExecuteV3Args } from '../types/types';
import path from 'path';
import fs from 'fs';

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


/**
 * Resolves file paths to locate contract files
 * @param {string} filePath - Original file path provided
 * @returns {string} Resolved file path
 */
export function resolveContractFilePath(filePath: string): string {
  // Try multiple possible base directories
  const possiblePaths = [
    // 1. Use as-is (if absolute)
    filePath,
    // 2. Relative to current working directory
    path.resolve(process.cwd(), filePath),
    // 3. Relative to the project root (assuming agents is at root level)
    path.resolve(process.cwd(), '..', filePath),
    // 4. Specific to your project structure
    path.resolve(process.cwd(), '..', 'plugins', 'contract', 'src', 'contract', path.basename(filePath))
  ];

  // Return the first path that exists
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`Found file at: ${p}`);
      return p;
    }
  }

  // If no valid path found, return the original (will fail later with better error)
  console.error(`Could not resolve path for: ${filePath}`);
  console.error(`Tried the following paths: ${possiblePaths.join(', ')}`);
  return filePath;
}
