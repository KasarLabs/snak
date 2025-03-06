import { validateAndParseAddress, uint256, num, RPC } from 'starknet';
import { ExecuteV3Args } from '../types/types';

export const validateAddress = (address: string): string => {
  try {
    return validateAndParseAddress(address);
  } catch (error) {
    throw new Error(`Invalid address: ${error.message}`);
  }
};

export const validateAndFormatTokenId = (tokenId: string) => {
  try {
    return uint256.bnToUint256(tokenId);
  } catch (error) {
    throw new Error(`Invalid token ID: ${error.message}`);
  }
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
  const maxL1Gas = 2000n;
  const maxL1GasPrice = 600000n * 10n ** 9n;

  const { transaction_hash } = await account.execute(call, {
    version: 3,
    maxFee: 10 ** 16,
    feeDataAvailabilityMode: RPC.EDataAvailabilityMode.L1,
    tip: 10 ** 14,
    paymasterData: [],
    resourceBounds: {
      l1_gas: {
        max_amount: num.toHex(maxL1Gas),
        max_price_per_unit: num.toHex(maxL1GasPrice),
      },
      l2_gas: {
        max_amount: num.toHex(0),
        max_price_per_unit: num.toHex(0),
      },
    },
  });

  const receipt = await account.waitForTransaction(transaction_hash);
  if (!receipt.isSuccess()) {
    throw new Error('Transaction confirmed but failed');
  }

  return transaction_hash;
};
