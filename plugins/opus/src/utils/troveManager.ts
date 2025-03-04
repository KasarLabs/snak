import {
  num,
  Account,
  Call,
  Contract,
  GetTransactionReceiptResponse,
} from 'starknet';
import { formatUnits, parseUnits } from 'ethers';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import {
  BorrowTroveResult,
  DepositTroveResult,
  GetBorrowFeeResult,
  GetTroveHealthResult,
  GetUserTrovesResult,
  OpenTroveResult,
  RepayTroveResult,
  WithdrawTroveResult,
} from '../interfaces';
import {
  AssetBalance,
  AssetBalanceInput,
  AssetBalances,
  AssetBalancesInput,
  BorrowTroveParams,
  DepositTroveParams,
  forgeFeePaidEventSchema,
  GetTroveHealthParams,
  GetUserTrovesParams,
  healthSchema,
  OpenTroveParams,
  RepayTroveParams,
  troveOpenedEventSchema,
  wadSchema,
  WithdrawTroveParams,
} from '../schemas';
import {
  getAbbotContract,
  getErc20Contract,
  getSentinelContract,
  getShrineContract,
} from './contracts';
import { tokenAddresses } from '../../../token/src/constants/erc20';

const FORGE_FEE_PAID_EVENT_IDENTIFIER =
  'opus::core::shrine::shrine::ForgeFeePaid';

const TROVE_OPENED_EVENT_IDENTIFIER = 'opus::core::abbot::abbot::TroveOpened';

/**
 * Manages trove operations including creation, borrowing, repayment, and health monitoring
 * @class TroveManager
 */
export class TroveManager {
  shrine: Contract;
  abbot: Contract;
  sentinel: Contract;
  yangs: bigint[];

  constructor(
    private agent: StarknetAgentInterface,
    private walletAddress: string
  ) {}

  /**
   * Initializes contracts and retrieves yang addresses
   * @async
   */
  async initialize() {
    const chainId = await this.agent.getProvider().getChainId();
    this.shrine = getShrineContract(chainId);
    this.abbot = getAbbotContract(chainId);
    this.sentinel = getSentinelContract(chainId);

    this.yangs = (await this.sentinel.get_yang_addresses()).map(
      (yang: string) => num.toBigInt(yang)
    );
  }

  /**
   * Retrieves all troves associated with a user
   * @async
   * @param {GetUserTrovesParams} params - Parameter schema containing user address
   * @returns {Promise<GetUserTrovesResult>} List of trove IDs or failure status
   */
  async getUserTroves(
    params: GetUserTrovesParams
  ): Promise<GetUserTrovesResult> {
    await this.initialize();
    try {
      const troves = await this.abbot.get_user_trove_ids(params.user);
      const formattedTroves = troves.map((troveId: bigint) => {
        return troveId.toString();
      });
      const getUserTrovesResult: GetUserTrovesResult = {
        status: 'success',
        troves: formattedTroves,
      };

      return getUserTrovesResult;
    } catch (error) {
      console.error('Detailed get user troves error:', error);
      if (error instanceof Error) {
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return {
        status: 'failure',
      };
    }
  }

  /**
   * Retrieves current borrowing fee percentage
   * @async
   * @returns {Promise<GetBorrowFeeResult>} Current borrow fee percentage or failure status
   */
  async getBorrowFee(): Promise<GetBorrowFeeResult> {
    await this.initialize();
    try {
      const borrowFee = wadSchema.safeParse(
        await this.shrine.get_forge_fee_pct()
      );
      const borrowFeePct = formatUnits(borrowFee.data!.value, 16);
      const getBorrowFeeResult: GetBorrowFeeResult = {
        status: 'success',
        borrow_fee: `${borrowFeePct}%`,
      };

      return getBorrowFeeResult;
    } catch (error) {
      console.error('Detailed get borrow fee error:', error);
      if (error instanceof Error) {
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return {
        status: 'failure',
      };
    }
  }

  /**
   * Gets health metrics for a specific trove
   * @async
   * @param {GetTroveHealthParams} params - Parameters containing trove ID
   * @returns {Promise<GetTroveHealthResult>} Trove health metrics or failure status
   */
  async getTroveHealth(
    params: GetTroveHealthParams
  ): Promise<GetTroveHealthResult> {
    await this.initialize();
    try {
      const troveHealth = healthSchema.safeParse(
        await this.shrine.get_trove_health(params.troveId)
      );
      const getTroveHealthResult: GetTroveHealthResult = {
        status: 'success',
        debt: troveHealth.data?.debt.formatted,
        value: troveHealth.data?.value.formatted,
        ltv: troveHealth.data?.ltv.formatted,
        threshold: troveHealth.data?.threshold.formatted,
      };

      return getTroveHealthResult;
    } catch (error) {
      console.error('Detailed get trove health error:', error);
      if (error instanceof Error) {
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return {
        status: 'failure',
      };
    }
  }

  /**
   * Extracts borrow fee information from transaction receipt
   * @param {GetTransactionReceiptResponse} txReceipt - Transaction receipt
   * @returns {[string, string]} Tuple of [fee amount, fee percentage]
   */
  getBorrowFeeFromEvent(
    txReceipt: GetTransactionReceiptResponse
  ): [string, string] {
    const shrineEvents = this.shrine.parseEvents(txReceipt);

    const forgeFeePaidEvent = forgeFeePaidEventSchema.safeParse(
      shrineEvents.find((event) => FORGE_FEE_PAID_EVENT_IDENTIFIER in event)![
        FORGE_FEE_PAID_EVENT_IDENTIFIER
      ]
    );
    return [
      forgeFeePaidEvent.data!.fee.formatted,
      forgeFeePaidEvent.data!.fee_pct.formatted,
    ];
  }

  /**
   * Validates and parses max borrow fee percentage
   * @async
   * @param {string} borrowFeePct - Maximum borrow fee percentage
   * @returns {Promise<bigint>} Parsed borrow fee in base units
   * @throws {Error} If max borrow fee is lower than current fee
   */
  async parseMaxBorrowFeePctWithCheck(borrowFeePct: string): Promise<bigint> {
    const maxBorrowFeePct = parseUnits(
      borrowFeePct.slice(0, -1),
      16 // 1% is equivalent to 10 ** 16
    );
    const currentBorrowFeePct = wadSchema.safeParse(
      await this.shrine.get_forge_fee_pct()
    );
    if (maxBorrowFeePct < currentBorrowFeePct.data!.value) {
      throw new Error(
        `Max borrow fee of ${borrowFeePct} is lower than current: ${
          currentBorrowFeePct.data!.formatted
        }%`
      );
    }

    return maxBorrowFeePct;
  }

  /**
   * Parses and validates asset balance input
   * @async
   * @param {AssetBalanceInput} assetBalanceInput - Input containing asset symbol and amount
   * @returns {Promise<AssetBalance>} Parsed asset balance
   * @throws {Error} If collateral is not valid
   */
  async parseAssetBalanceInput(
    assetBalanceInput: AssetBalanceInput
  ): Promise<AssetBalance> {
    const collateralAddress = tokenAddresses[assetBalanceInput.symbol];
    if (collateralAddress === undefined) {
      throw new Error(`Unknown token symbol ${assetBalanceInput.symbol}`);
    }
    if (!this.yangs.includes(num.toBigInt(collateralAddress))) {
      throw new Error(`${collateralAddress} is not a valid collateral`);
    }

    const asset = getErc20Contract(collateralAddress);
    const collateralDecimals = await asset.decimals();
    const collateralAmount = parseUnits(
      assetBalanceInput.amount,
      collateralDecimals
    );

    const assetBalance: AssetBalance = {
      address: collateralAddress,
      amount: collateralAmount,
    };
    return assetBalance;
  }

  /**
   * Prepares collateral deposits by creating approval calls
   * @async
   * @param {AssetBalancesInput} collaterals - List of collateral inputs
   * @returns {Promise<[AssetBalances, Call[]]>} Tuple of parsed balances and approval calls
   */
  async prepareCollateralDeposits(
    collaterals: AssetBalancesInput
  ): Promise<[AssetBalances, Call[]]> {
    const assetBalances: AssetBalances = [];
    const approveAssetsCalls: Call[] = [];

    await Promise.all(
      collaterals.map(async (collateral) => {
        const assetBalance = await this.parseAssetBalanceInput(collateral);
        assetBalances.push(assetBalance);

        const asset = getErc20Contract(assetBalance.address);
        const gate = await this.sentinel.get_gate_address(assetBalance.address);
        const approveCall = asset.populateTransaction.approve(
          gate,
          assetBalance.amount
        );

        approveAssetsCalls.push({
          contractAddress: approveCall.contractAddress,
          entrypoint: approveCall.entrypoint,
          calldata: approveCall.calldata,
        });
      })
    );

    return [assetBalances, approveAssetsCalls];
  }

  /**
   * Opens a new trove with specified collateral and borrow amount
   * @async
   * @param {OpenTroveParams} params - Parameters for opening trove
   * @param {StarknetAgentInterface} agent - Starknet agent interface
   * @returns {Promise<OpenTroveResult>} Transaction result including trove ID and fees
   */
  async openTroveTransaction(
    params: OpenTroveParams,
    agent: StarknetAgentInterface
  ): Promise<OpenTroveResult> {
    await this.initialize();
    try {
      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );

      const [assetBalances, approveAssetsCalls] =
        await this.prepareCollateralDeposits(params.collaterals);
      const borrowAmount = parseUnits(params.borrowAmount, 18);
      const maxBorrowFeePct = await this.parseMaxBorrowFeePctWithCheck(
        params.maxBorrowFeePct
      );

      const openTroveCall = await this.abbot.populateTransaction.open_trove(
        assetBalances,
        { val: borrowAmount },
        { val: maxBorrowFeePct }
      );

      const tx = await account.execute([
        ...approveAssetsCalls,
        {
          contractAddress: openTroveCall.contractAddress,
          entrypoint: openTroveCall.entrypoint,
          calldata: openTroveCall.calldata,
        },
      ]);

      const provider = agent.getProvider();
      const txReceipt = await provider.waitForTransaction(tx.transaction_hash);

      let troveId;
      let borrowFeePaid;
      let borrowFeePct;
      if (txReceipt.isSuccess()) {
        const abbotEvents = this.abbot.parseEvents(txReceipt);
        const troveOpenedEvent = abbotEvents.find(
          (event) => TROVE_OPENED_EVENT_IDENTIFIER in event
        )![TROVE_OPENED_EVENT_IDENTIFIER];
        const parsedTroveOpenedEvent =
          troveOpenedEventSchema.safeParse(troveOpenedEvent);
        troveId = parsedTroveOpenedEvent.data!.trove_id.toString();

        [borrowFeePaid, borrowFeePct] = this.getBorrowFeeFromEvent(txReceipt);
      }

      const openTroveResult: OpenTroveResult = {
        status: 'success',
        trove_id: troveId,
        borrow_fee: borrowFeePaid,
        borrow_fee_pct: borrowFeePct,
        transaction_hash: tx.transaction_hash,
      };

      return openTroveResult;
    } catch (error) {
      console.error('Detailed open trove error:', error);
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

  /**
   * Deposits additional collateral to an existing trove
   * @async
   * @param {DepositTroveParams} params - Parameters for deposit
   * @param {StarknetAgentInterface} agent - Starknet agent interface
   * @returns {Promise<DepositTroveResult>} Transaction result including health metrics
   */
  async depositTransaction(
    params: DepositTroveParams,
    agent: StarknetAgentInterface
  ): Promise<DepositTroveResult> {
    await this.initialize();
    try {
      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );

      const [assetBalances, approveAssetsCalls] =
        await this.prepareCollateralDeposits([params.collateral]);

      const depositCall = await this.abbot.populateTransaction.deposit(
        params.troveId,
        assetBalances[0]
      );

      const beforeHealth = healthSchema.safeParse(
        await this.shrine.get_trove_health(params.troveId)
      );
      const tx = await account.execute([
        ...approveAssetsCalls,
        {
          contractAddress: depositCall.contractAddress,
          entrypoint: depositCall.entrypoint,
          calldata: depositCall.calldata,
        },
      ]);

      const provider = agent.getProvider();
      const txReceipt = await provider.waitForTransaction(tx.transaction_hash);

      let afterHealth;
      if (txReceipt.isSuccess()) {
        afterHealth = healthSchema.safeParse(
          await this.shrine.get_trove_health(params.troveId)
        );
      }

      const depositResult: DepositTroveResult = {
        status: 'success',
        trove_id: params.troveId.toString(),
        before_value: beforeHealth.data?.value.formatted,
        after_value: afterHealth?.data?.value.formatted,
        before_ltv: beforeHealth.data?.ltv.formatted,
        after_ltv: afterHealth?.data?.ltv.formatted,
        transaction_hash: tx.transaction_hash,
      };

      return depositResult;
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

  /**
   * Withdraws collateral from an existing trove
   * @async
   * @param {WithdrawTroveParams} params - Parameters for withdrawal
   * @param {StarknetAgentInterface} agent - Starknet agent interface
   * @returns {Promise<WithdrawTroveResult>} Transaction result including health metrics
   */
  async withdrawTransaction(
    params: WithdrawTroveParams,
    agent: StarknetAgentInterface
  ): Promise<WithdrawTroveResult> {
    await this.initialize();
    try {
      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );

      const assetBalance = await this.parseAssetBalanceInput(params.collateral);

      const depositCall = await this.abbot.populateTransaction.withdraw(
        params.troveId,
        assetBalance
      );

      const beforeHealth = healthSchema.safeParse(
        await this.shrine.get_trove_health(params.troveId)
      );
      const tx = await account.execute([
        {
          contractAddress: depositCall.contractAddress,
          entrypoint: depositCall.entrypoint,
          calldata: depositCall.calldata,
        },
      ]);

      const provider = agent.getProvider();
      const txReceipt = await provider.waitForTransaction(tx.transaction_hash);

      let afterHealth;
      if (txReceipt.isSuccess()) {
        afterHealth = healthSchema.safeParse(
          await this.shrine.get_trove_health(params.troveId)
        );
      }

      const withdrawResult: WithdrawTroveResult = {
        status: 'success',
        trove_id: params.troveId.toString(),
        before_value: beforeHealth.data?.value.formatted,
        after_value: afterHealth?.data?.value.formatted,
        before_ltv: beforeHealth.data?.ltv.formatted,
        after_ltv: afterHealth?.data?.ltv.formatted,
        transaction_hash: tx.transaction_hash,
      };

      return withdrawResult;
    } catch (error) {
      console.error('Detailed withdraw error:', error);
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

  /**
   * Borrows additional tokens from an existing trove
   * @async
   * @param {BorrowTroveParams} params - Parameters for borrowing
   * @param {StarknetAgentInterface} agent - Starknet agent interface
   * @returns {Promise<BorrowTroveResult>} Transaction result including borrowed amount and fees
   */
  async borrowTransaction(
    params: BorrowTroveParams,
    agent: StarknetAgentInterface
  ): Promise<BorrowTroveResult> {
    await this.initialize();
    try {
      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );

      const borrowAmount = parseUnits(params.amount, 18);
      const maxBorrowFeePct = await this.parseMaxBorrowFeePctWithCheck(
        params.maxBorrowFeePct
      );
      const borrowCall = await this.abbot.populateTransaction.forge(
        params.troveId,
        { val: borrowAmount },
        { val: maxBorrowFeePct }
      );

      const beforeHealth = healthSchema.safeParse(
        await this.shrine.get_trove_health(params.troveId)
      );
      const tx = await account.execute([
        {
          contractAddress: borrowCall.contractAddress,
          entrypoint: borrowCall.entrypoint,
          calldata: borrowCall.calldata,
        },
      ]);

      const provider = agent.getProvider();
      const txReceipt = await provider.waitForTransaction(tx.transaction_hash);

      let afterHealth;
      let borrowFeePaid;
      let borrowFeePct;
      if (txReceipt.isSuccess()) {
        afterHealth = healthSchema.safeParse(
          await this.shrine.get_trove_health(params.troveId)
        );

        [borrowFeePaid, borrowFeePct] = this.getBorrowFeeFromEvent(txReceipt);
      }

      const borrowResult: BorrowTroveResult = {
        status: 'success',
        trove_id: params.troveId.toString(),
        amount: borrowAmount.toString(),
        borrow_fee: borrowFeePaid,
        borrow_fee_pct: borrowFeePct,
        before_debt: beforeHealth.data?.debt.formatted,
        after_debt: afterHealth?.data?.debt.formatted,
        before_ltv: beforeHealth.data?.ltv.formatted,
        after_ltv: afterHealth?.data?.ltv.formatted,
        transaction_hash: tx.transaction_hash,
      };

      return borrowResult;
    } catch (error) {
      console.error('Detailed borrow error:', error);
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

  /**
   * Repays debt for an existing trove
   * @async
   * @param {RepayTroveParams} params - Parameters for repayment
   * @param {StarknetAgentInterface} agent - Starknet agent interface
   * @returns {Promise<RepayTroveResult>} Transaction result including updated debt metrics
   */
  async repayTransaction(
    params: RepayTroveParams,
    agent: StarknetAgentInterface
  ): Promise<RepayTroveResult> {
    await this.initialize();
    try {
      const account = new Account(
        this.agent.contractInteractor.provider,
        this.walletAddress,
        this.agent.getAccountCredentials().accountPrivateKey
      );

      const repayAmount = parseUnits(params.amount, 18);
      const repayCall = await this.abbot.populateTransaction.melt(
        params.troveId,
        { val: repayAmount }
      );

      const beforeHealth = healthSchema.safeParse(
        await this.shrine.get_trove_health(params.troveId)
      );
      const tx = await account.execute([
        {
          contractAddress: repayCall.contractAddress,
          entrypoint: repayCall.entrypoint,
          calldata: repayCall.calldata,
        },
      ]);

      const provider = agent.getProvider();
      const txReceipt = await provider.waitForTransaction(tx.transaction_hash);

      let afterHealth;
      if (txReceipt.isSuccess()) {
        afterHealth = healthSchema.safeParse(
          await this.shrine.get_trove_health(params.troveId)
        );
      }

      const repayResult: RepayTroveResult = {
        status: 'success',
        trove_id: params.troveId.toString(),
        amount: repayAmount.toString(),
        before_debt: beforeHealth.data?.debt.formatted,
        after_debt: afterHealth?.data?.debt.formatted,
        before_ltv: beforeHealth.data?.ltv.formatted,
        after_ltv: afterHealth?.data?.ltv.formatted,
        transaction_hash: tx.transaction_hash,
      };

      return repayResult;
    } catch (error) {
      console.error('Detailed repay error:', error);
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
 * Creates a new TroveManager instance
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {string} [walletAddress] - Optional wallet address
 * @returns {TroveManager} New TroveManager instance
 * @throws {Error} If wallet address is not provided
 */
export const createTroveManager = (
  agent: StarknetAgentInterface,
  walletAddress?: string
): TroveManager => {
  if (!walletAddress) {
    throw new Error('Wallet address not configured');
  }

  const service = new TroveManager(agent, walletAddress);
  return service;
};
