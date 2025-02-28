import { RpcProvider } from 'starknet';
import {
  BRAAVOS_INITIAL_CLASSHASH,
  BRAAVOS_PROXY_CLASSHASH,
  BRAAVOS_ACCOUNT_CLASSHASH,
} from '../constant/contract';
import { AccountManager } from '../utils/AccountManager';

/**
 * Creates a new Braavos account with generated keys and address.
 * @async
 * @function CreateBraavosAccount
 * @returns {Promise<string>} JSON string with account details and creation status
 * @throws {Error} If account creation fails
 */
export const CreateBraavosAccount = async () => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
    const accountManager = new AccountManager(
      provider,
      BRAAVOS_INITIAL_CLASSHASH,
      BRAAVOS_PROXY_CLASSHASH,
      BRAAVOS_ACCOUNT_CLASSHASH
    );

    const accountDetails = await accountManager.createAccount();

    return JSON.stringify({
      status: 'success',
      wallet: 'Braavos',
      publicKey: accountDetails.publicKey,
      privateKey: accountDetails.privateKey,
      contractAddress: accountDetails.contractAddress,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Creates a new Braavos account and estimates deployment fees.
 * @async
 * @function CreateBraavosAccountSignature
 * @returns {Promise<string>} JSON string with account details and estimated deployment fee
 * @throws {Error} If account creation or fee estimation fails
 */
export const CreateBraavosAccountSignature = async () => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const accountManager = new AccountManager(
      provider,
      BRAAVOS_INITIAL_CLASSHASH,
      BRAAVOS_PROXY_CLASSHASH,
      BRAAVOS_ACCOUNT_CLASSHASH
    );

    const accountDetails = await accountManager.createAccount();

    const suggestedMaxFee =
      await accountManager.estimateAccountDeployFee(accountDetails);
    const maxFee = suggestedMaxFee * 2n;

    return JSON.stringify({
      status: 'success',
      transaction_type: 'CREATE_ACCOUNT',
      wallet: 'Braavos',
      publicKey: accountDetails.publicKey,
      privateKey: accountDetails.privateKey,
      contractAddress: accountDetails.contractAddress,
      deployFee: maxFee.toString(),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
