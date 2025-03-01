import { Account, Call } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import {
  Address,
  WithdrawParams,
  IBaseToken,
  IPool,
  IPoolAsset,
  ITokenValue,
  poolParser,
  WithdrawResult,
} from '../interfaces';
import {
  DEFAULT_DECIMALS,
  GENESIS_POOLID,
  VESU_API_URL,
} from '../constants/index';
import { Hex, toBN, toU256 } from '../utils/num';
import {
  getErc20Contract,
  getExtensionContract,
  getVTokenContract,
} from '../utils/contracts';

/**
 * Service for managing withdrawal operations from earning positions
 * @class WithdrawEarnService
 */
export class WithdrawEarnService {
  /**
   * Creates an instance of WithdrawEarnService
   * @param {StarknetAgentInterface} agent - The Starknet agent for blockchain interactions
   * @param {string} walletAddress - The wallet address executing the withdrawals
   */
  constructor(
    private agent: StarknetAgentInterface,
    private walletAddress: string
  ) {}

  /**
   * Retrieves token price from the pool extension contract
   * @param {IBaseToken} token - The token to get price for
   * @param {string} poolId - The pool identifier
   * @param {Hex} poolExtension - The pool extension contract address
   * @returns {Promise<ITokenValue | undefined>} Token price information if available
   */
  public async getTokenPrice(
    token: IBaseToken,
    poolId: string,
    poolExtension: Hex
  ): Promise<ITokenValue | undefined> {
    const contract = getExtensionContract(poolExtension);

    try {
      const res = await contract.price(poolId, token.address);
      return res.is_valid && res.value
        ? { value: toBN(res.value), decimals: DEFAULT_DECIMALS }
        : undefined;
    } catch (err) {
      console.log('error', err);
      return undefined;
    }
  }

  /**
   * Retrieves and updates pool assets with their prices
   * @private
   * @param {IPool['id']} poolId - Pool identifier
   * @param {IPool['extensionContractAddress']} poolExtensionContractAddress - Extension contract address
   * @param {IPoolAsset[]} poolAssets - Array of pool assets
   * @returns {Promise<IPoolAsset[]>} Updated pool assets with prices
   */
  private async getPoolAssetsPrice(
    poolId: IPool['id'],
    poolExtensionContractAddress: IPool['extensionContractAddress'],
    poolAssets: IPoolAsset[]
  ): Promise<IPoolAsset[]> {
    return await Promise.all(
      poolAssets.map(async (asset) => {
        const [usdPrice] = await Promise.all([
          this.getTokenPrice(asset, poolId, poolExtensionContractAddress),
        ]);

        return {
          ...asset,
          usdPrice,
        };
      })
    );
  }

  /**
   * Retrieves and updates pool assets with prices and risk metrics
   * @private
   * @param {IPool['id']} poolId - Pool identifier
   * @param {IPool['extensionContractAddress']} poolExtensionContractAddress - Extension contract address
   * @param {IPoolAsset[]} poolAssets - Array of pool assets
   * @returns {Promise<IPoolAsset[]>} Updated pool assets with prices and risk metrics
   */
  private async getPoolAssetsPriceAndRiskMdx(
    poolId: IPool['id'],
    poolExtensionContractAddress: IPool['extensionContractAddress'],
    poolAssets: IPoolAsset[]
  ): Promise<IPoolAsset[]> {
    return await Promise.all(
      poolAssets.map(async (asset) => {
        const [usdPrice, riskMdx] = await Promise.all([
          this.getTokenPrice(asset, poolId, poolExtensionContractAddress),
          Promise.resolve(undefined),
        ]);

        return {
          ...asset,
          risk: null,
          usdPrice,
        };
      })
    );
  }

  /**
   * Retrieves pool information and updates assets with prices
   * @param {string} poolId - Pool identifier
   * @returns {Promise<IPool>} Updated pool information
   */
  public async getPool(poolId: string): Promise<IPool> {
    const data = await fetch(`${VESU_API_URL}/pools/${poolId}`).then((res) =>
      res.json()
    );
    const pool = z
      .object({ data: poolParser })
      .transform(({ data }) => data)
      .parse(data);
    const assets = await this.getPoolAssetsPriceAndRiskMdx(
      pool.id,
      pool.extensionContractAddress,
      pool.assets
    );

    return { ...pool, assets };
  }

  /**
   * Retrieves token balance for a given wallet address
   * @param {IBaseToken} baseToken - The token to check balance for
   * @param {Hex} walletAddress - The wallet address to check
   * @returns {Promise<bigint>} Token balance
   */
  async getTokenBalance(
    baseToken: IBaseToken,
    walletAddress: Hex
  ): Promise<bigint> {
    const tokenContract = getErc20Contract(baseToken.address);

    return await tokenContract
      .balanceOf(walletAddress)
      .then(toBN)
      .catch((err: unknown) => {
        console.error(
          new Error(`Failed to get balance of ${baseToken.address}`)
        );
        return 0n;
      });
  }

  /**
   * Generates approval calls for vToken operations
   * @param {Address} assetAddress - Address of the asset to approve
   * @param {Address} vTokenAddress - Address of the vToken
   * @param {bigint} amount - Amount to approve
   * @returns {Promise<Call>} Approval transaction call
   */
  async approveVTokenCalls(
    assetAddress: Address,
    vTokenAddress: Address,
    amount: bigint
  ): Promise<Call> {
    const tokenContract = getErc20Contract(assetAddress);

    const approveCall = tokenContract.populateTransaction.approve(
      vTokenAddress,
      amount
    );

    return approveCall;
  }

  /**
   * Executes a withdrawal transaction
   * @param {WithdrawParams} params - Withdrawal parameters
   * @param {StarknetAgentInterface} agent - Starknet agent
   * @returns {Promise<WithdrawResult>} Result of the withdrawal operation
   */
  async withdrawEarnTransaction(
    params: WithdrawParams,
    agent: StarknetAgentInterface
  ): Promise<WithdrawResult> {
    try {
      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );
      const pool = await this.getPool(GENESIS_POOLID);

      const collateralPoolAsset = pool.assets.find(
        (a) =>
          a.symbol.toLocaleUpperCase() ===
          params.withdrawTokenSymbol.toLocaleUpperCase()
      );

      if (!collateralPoolAsset) {
        throw new Error('Collateral asset not found in pool');
      }
      console.log(
        'collateralPoolAsset.decimals===',
        collateralPoolAsset.decimals
      );

      const vtokenContract = getVTokenContract(
        collateralPoolAsset.vToken.address
      );

      const vTokenShares = await this.getTokenBalance(
        collateralPoolAsset.vToken,
        account.address as Hex
      );

      const credentials = agent.getAccountCredentials();
      const provider = agent.getProvider();

      const wallet = new Account(
        provider,
        credentials.accountPublicKey,
        credentials.accountPrivateKey
      );

      const redeemVTokenCall = await vtokenContract.populateTransaction.redeem(
        toU256(vTokenShares),
        account.address,
        account.address
      );

      const tx = await wallet.execute([
        {
          contractAddress: redeemVTokenCall.contractAddress,
          entrypoint: redeemVTokenCall.entrypoint,
          calldata: redeemVTokenCall.calldata,
        },
      ]);

      console.log('approval initiated. Transaction hash:', tx.transaction_hash);
      await provider.waitForTransaction(tx.transaction_hash);

      const transferResult: WithdrawResult = {
        status: 'success',
        symbol: params.withdrawTokenSymbol,
        recipients_address: account.address,
        transaction_hash: tx.transaction_hash,
      };

      return transferResult;
    } catch (error) {
      console.error('Detailed deposit error:', error);
      if (error instanceof Error) {
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Creates a new WithdrawEarnService instance
 * @param {StarknetAgentInterface} agent - The Starknet agent
 * @param {string} [walletAddress] - The wallet address
 * @returns {WithdrawEarnService} A new WithdrawEarnService instance
 * @throws {Error} If wallet address is not provided
 */
export const withdrawService = (
  agent: StarknetAgentInterface,
  walletAddress?: string
): WithdrawEarnService => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }

  return new WithdrawEarnService(agent, walletAddress);
};

/**
 * Utility function to execute a withdrawal operation
 * @param {StarknetAgentInterface} agent - The Starknet agent
 * @param {WithdrawParams} params - The withdrawal parameters
 * @returns {Promise<string>} JSON string containing the withdrawal result
 */
export const withdrawEarnPosition = async (
  agent: StarknetAgentInterface,
  params: WithdrawParams
) => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
  console.log('hello withdraw', accountAddress);
  try {
    const withdrawEarn = withdrawService(agent, accountAddress);
    const result = await withdrawEarn.withdrawEarnTransaction(params, agent);
    return JSON.stringify(result);
  } catch (error) {
    console.error('Detailed withdraw error:', error);
    if (error instanceof Error) {
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
