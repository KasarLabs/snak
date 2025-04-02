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
 * Searches for a file by traversing up the directory tree
 * @param filename The filename to search for
 * @param startDir The starting directory (default: current working directory)
 * @returns The full path if found, null otherwise
 */
function findUp(
  filename: string,
  startDir: string = process.cwd()
): string | null {
  let currentDir = path.resolve(startDir);
  const { root } = path.parse(currentDir);

  while (true) {
    const filePath = path.join(currentDir, filename);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    // Stop if we reach the filesystem root
    if (currentDir === root) {
      return null;
    }

    // Move up one level
    currentDir = path.dirname(currentDir);
  }
}

/**
 * Detects the repository root by looking for the lerna.json file
 * @returns Absolute path to the repository root
 */
function getRepoRoot(): string {
  const lernaJsonPath = findUp('lerna.json');
  if (!lernaJsonPath) {
    throw new Error('Unable to find repository root (lerna.json not found)');
  }
  return path.dirname(lernaJsonPath);
}

/**
 * Resolves file paths to locate contract files
 * Simply joins the repo root with the provided path
 * @param {string} filePath - Original file path provided
 * @returns {string} Resolved file path
 */
export function resolveContractFilePath(filePath: string): string {
  // If the path is already absolute and exists, return it as is
  if (path.isAbsolute(filePath)) {
    if (fs.existsSync(filePath)) {
      return filePath;
    } else {
      // Even if it's absolute but doesn't exist, we'll still try from repo root
      console.warn(`Absolute path provided but does not exist: ${filePath}`);
    }
  }

  // Get the repository root
  const repoRoot = getRepoRoot();

  // Join the repo root with the provided path
  const resolvedPath = path.join(repoRoot, filePath);

  // Check if the path exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  return resolvedPath;
}
