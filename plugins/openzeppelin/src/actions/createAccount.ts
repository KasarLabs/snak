import { RpcProvider } from 'starknet';
import { OZ_CLASSHASH } from '../constant/contract';
import { AccountManager } from '../utils/AccountManager';

/**
 * Creates a new OpenZeppelin account.
 * @async
 * @function CreateOZAccount
 * @returns {Promise<string>} JSON string with account details
 * @throws {Error} If account creation fails
 */
export const CreateOZAccount = async () => {
  try {
    const accountManager = new AccountManager(undefined);
    const accountDetails = await accountManager.createAccount(OZ_CLASSHASH);

    return JSON.stringify({
      status: 'success',
      wallet: 'Open Zeppelin',
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
 * Creates an OpenZeppelin account with deployment fee estimation.
 * @async
 * @function CreateOZAccountSignature
 * @returns {Promise<string>} JSON string with account and fee details
 * @throws {Error} If creation or fee estimation fails
 */
export const CreateOZAccountSignature = async () => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const accountManager = new AccountManager(provider);
    const accountDetails = await accountManager.createAccount(OZ_CLASSHASH);
    const suggestedMaxFee = await accountManager.estimateAccountDeployFee(
      OZ_CLASSHASH,
      accountDetails
    );
    const maxFee = suggestedMaxFee.suggestedMaxFee * 2n;

    return JSON.stringify({
      status: 'success',
      transaction_type: 'CREATE_ACCOUNT',
      wallet: 'OpenZeppelin',
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
