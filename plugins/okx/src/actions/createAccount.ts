import { RpcProvider } from 'starknet';
import { OKX_CLASSHASH } from '../constant/contract';
import { AccountManager } from '../utils/AccountManager';

/**
 * Creates a new OKX account.
 * @async
 * @function CreateOKXAccount
 * @returns {Promise<string>} JSON string with account details
 * @throws {Error} If account creation fails
 */
export const CreateOKXAccount = async () => {
  try {
    const accountManager = new AccountManager(undefined);
    const accountDetails = await accountManager.createAccount(OKX_CLASSHASH);

    return JSON.stringify({
      status: 'success',
      wallet: 'OKX',
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
 * Creates an OKX account with deployment fee estimation.
 * @async
 * @function CreateOKXAccountSignature
 * @returns {Promise<string>} JSON string with account and fee details
 * @throws {Error} If creation or fee estimation fails
 */
export const CreateOKXAccountSignature = async () => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const accountManager = new AccountManager(provider);
    const accountDetails = await accountManager.createAccount(OKX_CLASSHASH);
    const suggestedMaxFee = await accountManager.estimateAccountDeployFee(
      OKX_CLASSHASH,
      accountDetails
    );
    const maxFee = suggestedMaxFee.suggestedMaxFee * 2n;

    return JSON.stringify({
      status: 'success',
      transaction_type: 'CREATE_ACCOUNT',
      wallet: 'OKX',
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
