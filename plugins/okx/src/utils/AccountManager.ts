import { Account, CallData, stark, hash, ec } from 'starknet';
import {
  AccountDetails,
  AccountResponse,
  BaseUtilityClass,
  TransactionResult,
} from '../types/accounts';

/**
 * Manages Starknet account operations including creation, deployment, and fee estimation.
 * @class
 * @implements {BaseUtilityClass}
 */
export class AccountManager implements BaseUtilityClass {
  constructor(public provider: any) {}

  /**
   * Creates a new account with generated keys.
   * @async
   * @param {string} accountClassHash - The class hash for the account type
   * @returns {Promise<AccountDetails>} The created account details
   * @throws {Error} If account creation fails
   */
  async createAccount(accountClassHash: string): Promise<AccountDetails> {
    try {
      const privateKey = stark.randomAddress();
      const publicKey = ec.starkCurve.getStarkKey(privateKey);

      const constructorCallData = CallData.compile({ publicKey });
      const contractAddress = hash.calculateContractAddressFromHash(
        publicKey,
        accountClassHash,
        constructorCallData,
        0
      );

      return {
        contractAddress,
        privateKey,
        publicKey,
      };
    } catch (error) {
      throw new Error(`Failed to create account: ${error.message}`);
    }
  }

  /**
   * Deploys an account to the network.
   * @async
   * @param {string} accountClassHash - The class hash for the account type
   * @param {AccountDetails} accountDetails - The account details
   * @returns {Promise<TransactionResult>} The deployment result
   * @throws {Error} If deployment fails
   */
  async deployAccount(
    accountClassHash: string,
    accountDetails: AccountDetails
  ): Promise<TransactionResult> {
    try {
      const account = new Account(
        this.provider,
        accountDetails.contractAddress,
        accountDetails.privateKey
      );

      const constructorCallData = CallData.compile({
        publicKey: accountDetails.publicKey,
      });

      const { transaction_hash, contract_address } =
        await account.deployAccount({
          classHash: accountClassHash,
          constructorCalldata: constructorCallData,
          addressSalt: accountDetails.publicKey,
        });

      await this.provider.waitForTransaction(transaction_hash);

      return {
        status: 'success',
        transactionHash: transaction_hash,
        contractAddress: contract_address,
      };
    } catch (error) {
      throw new Error(`Failed to create account: ${error.message}`);
    }
  }

  /**
   * Estimates account deployment fee.
   * @async
   * @param {string} accountClassHash - The class hash for the account type
   * @param {AccountDetails} accountDetails - The account details
   * @returns {Promise<Object>} The estimated fee details
   * @throws {Error} If fee estimation fails
   */
  async estimateAccountDeployFee(
    accountClassHash: string,
    accountDetails: AccountDetails
  ) {
    try {
      const account = new Account(
        this.provider,
        accountDetails.contractAddress,
        accountDetails.privateKey
      );

      const constructorCallData = CallData.compile({
        publicKey: accountDetails.publicKey,
      });

      return await account.estimateAccountDeployFee({
        classHash: accountClassHash,
        constructorCalldata: constructorCallData,
        addressSalt: accountDetails.publicKey,
      });
    } catch (error) {
      throw new Error(`Failed to estimate deploy fee: ${error.message}`);
    }
  }
}

/**
 * Wraps account creation response to format it according to the mode
 * @param response The raw JSON response from account creation
 * @param isSignatureMode Whether we're in signature mode or key mode
 * @returns Formatted JSON response
 */
export const wrapAccountCreationResponse = (response: string) => {
  try {
    const data = JSON.parse(response) as AccountResponse;
    if (data.status === 'success') {
      return JSON.stringify({
        ...data,
        message: `✅ Your ${data.wallet} account has been successfully created at ${data.contractAddress}\nPublic key: ${data.publicKey}\nPrivate key: ${data.privateKey}`,
      });
    }
    return response;
  } catch {
    return response;
  }
};
