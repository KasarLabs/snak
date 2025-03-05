import { uint256, num, RPC } from 'starknet';
import { ExecuteV3Args } from '../types/types';

/**
 * Converts a bigint address to a hex string
 * @param {bigint} addressAsBigInt - Address as a bigint
 * @returns {string} Address as a hex string
 */
export const bigintToHex = (addressAsBigInt: bigint): string => {
  let hexString = addressAsBigInt.toString(16);

  hexString = hexString.padStart(64, '0');
  hexString = '0x' + hexString;

  return hexString;
};

/**
 * Validates and formats a token ID
 * @param {string} tokenId - Token ID as a string
 * @returns {bigint} Token ID as a bigint
 * @throws {Error} If token ID is invalid
 */
export const validateAndFormatTokenId = (tokenId: string) => {
  try {
    return uint256.bnToUint256(tokenId);
  } catch (error) {
    throw new Error(`Invalid token ID: ${error.message}`);
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
