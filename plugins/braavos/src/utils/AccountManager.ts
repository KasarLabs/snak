import {
  CallData,
  stark,
  hash,
  ec,
  constants,
  RpcProvider,
  BigNumberish,
  Calldata,
  num,
} from 'starknet';

import {
  AccountDetails,
  AccountResponse,
  BaseUtilityClass,
  TransactionResult,
} from '../types/accounts';

/**
 * Manages Braavos wallet operations using Starknet's proxy pattern.
 * Handles account creation, deployment, and fee estimation specifically for Braavos implementation.
 * @class
 * @implements {BaseUtilityClass}
 */
export class AccountManager implements BaseUtilityClass {
  constructor(
    public provider: RpcProvider,
    public initialClassHash: string,
    public proxyClassHash: string,
    public accountClassHash: string
  ) {}

  /**
   * Creates a new account instance with generated keys.
   * @async
   * @method createAccount
   * @returns {Promise<AccountDetails>} The created account details
   * @throws {Error} If account creation fails
   */
  async createAccount(): Promise<AccountDetails> {
    try {
      const privateKey = stark.randomAddress();
      const publicKey = ec.starkCurve.getStarkKey(privateKey);

      const initializer = this.calcInit(publicKey);
      const constructorCalldata = this.getProxyConstructor(initializer);

      const contractAddress = hash.calculateContractAddressFromHash(
        publicKey,
        this.proxyClassHash,
        constructorCalldata,
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
   * Estimates the fee required to deploy an account.
   * @async
   * @method estimateAccountDeployFee
   * @param {AccountDetails} accountDetails - The account details for deployment
   * @returns {Promise<bigint>} The estimated maximum fee
   * @throws {Error} If fee estimation fails
   */
  async estimateAccountDeployFee(
    accountDetails: AccountDetails
  ): Promise<bigint> {
    try {
      const version = constants.TRANSACTION_VERSION.V1;
      const nonce = constants.ZERO;
      const chainId = await this.provider.getChainId();

      const initializer = this.calcInit(accountDetails.publicKey);
      const constructorCalldata = this.getProxyConstructor(initializer);

      const signature = this.getBraavosSignature(
        accountDetails.contractAddress,
        constructorCalldata,
        accountDetails.publicKey,
        BigInt(version),
        constants.ZERO,
        chainId,
        BigInt(nonce),
        accountDetails.privateKey
      );

      const deployAccountPayload = {
        classHash: this.proxyClassHash,
        constructorCalldata,
        addressSalt: accountDetails.publicKey,
        signature,
      };

      const response = await this.provider.getDeployAccountEstimateFee(
        deployAccountPayload,
        { version, nonce }
      );

      return stark.estimatedFeeToMaxFee(response.overall_fee);
    } catch (error) {
      throw new Error(`Failed to estimate deploy fee: ${error.message}`);
    }
  }

  /**
   * Deploys an account contract to the network.
   * @async
   * @method deployAccount
   * @param {AccountDetails} accountDetails - The account details for deployment
   * @param {BigNumberish} [maxFee] - Optional maximum fee for deployment
   * @returns {Promise<TransactionResult>} The deployment transaction result
   * @throws {Error} If deployment fails
   */
  async deployAccount(
    accountDetails: AccountDetails,
    maxFee?: BigNumberish
  ): Promise<TransactionResult> {
    try {
      const version = constants.TRANSACTION_VERSION.V1;
      const nonce = constants.ZERO;
      const chainId = await this.provider.getChainId();

      const initializer = this.calcInit(accountDetails.publicKey);
      const constructorCalldata = this.getProxyConstructor(initializer);

      maxFee = maxFee ?? (await this.estimateAccountDeployFee(accountDetails));

      const signature = this.getBraavosSignature(
        accountDetails.contractAddress,
        constructorCalldata,
        accountDetails.publicKey,
        BigInt(version),
        maxFee,
        chainId,
        BigInt(nonce),
        accountDetails.privateKey
      );

      const { transaction_hash, contract_address } =
        await this.provider.deployAccountContract(
          {
            classHash: this.proxyClassHash,
            constructorCalldata,
            addressSalt: accountDetails.publicKey,
            signature,
          },
          {
            nonce,
            maxFee,
            version,
          }
        );

      await this.provider.waitForTransaction(transaction_hash);

      return {
        status: 'success',
        transactionHash: transaction_hash,
        contractAddress: contract_address,
      };
    } catch (error) {
      throw new Error(`Failed to deploy account: ${error.message}`);
    }
  }

  private calcInit(publicKey: string): Calldata {
    return CallData.compile({ public_key: publicKey });
  }

  private getProxyConstructor(initializer: Calldata): Calldata {
    return CallData.compile({
      implementation_address: this.initialClassHash,
      initializer_selector: hash.getSelectorFromName('initializer'),
      calldata: [...initializer],
    });
  }

  private getBraavosSignature(
    contractAddress: BigNumberish,
    constructorCalldata: Calldata,
    publicKey: BigNumberish,
    version: bigint,
    maxFee: BigNumberish,
    chainId: constants.StarknetChainId,
    nonce: bigint,
    privateKey: BigNumberish
  ): string[] {
    const txHash = hash.calculateDeployAccountTransactionHash({
      contractAddress,
      classHash: this.proxyClassHash,
      constructorCalldata,
      salt: publicKey,
      version: constants.TRANSACTION_VERSION.V1,
      maxFee,
      chainId,
      nonce,
    });

    const parsedOtherSigner = [0, 0, 0, 0, 0, 0, 0];
    const { r, s } = ec.starkCurve.sign(
      hash.computeHashOnElements([
        txHash,
        this.accountClassHash,
        ...parsedOtherSigner,
      ]),
      num.toHex(privateKey)
    );

    return [
      r.toString(),
      s.toString(),
      this.accountClassHash.toString(),
      ...parsedOtherSigner.map((e) => e.toString()),
    ];
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
