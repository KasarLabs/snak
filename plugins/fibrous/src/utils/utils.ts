import {
    num,
    RPC,
    Call, 
    Account
  } from 'starknet';

/**
 * V3 transaction execution arguments
 * @property {Call} call
 * @property {Account} account
 */
export interface ExecuteV3Args {
    call: Call;
    account: Account;
  }
  

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
  