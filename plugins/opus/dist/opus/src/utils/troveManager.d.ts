import { Call, Contract, GetTransactionReceiptResponse } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { BorrowTroveResult, DepositTroveResult, GetBorrowFeeResult, GetTroveHealthResult, GetUserTrovesResult, OpenTroveResult, RepayTroveResult, WithdrawTroveResult } from '../interfaces';
import { AssetBalance, AssetBalanceInput, AssetBalances, AssetBalancesInput, BorrowTroveParams, DepositTroveParams, GetTroveHealthParams, GetUserTrovesParams, OpenTroveParams, RepayTroveParams, WithdrawTroveParams } from '../schemas';
export declare class TroveManager {
    private agent;
    private walletAddress;
    shrine: Contract;
    abbot: Contract;
    sentinel: Contract;
    yangs: bigint[];
    constructor(agent: StarknetAgentInterface, walletAddress: string);
    initialize(): Promise<void>;
    getUserTroves(params: GetUserTrovesParams): Promise<GetUserTrovesResult>;
    getBorrowFee(): Promise<GetBorrowFeeResult>;
    getTroveHealth(params: GetTroveHealthParams): Promise<GetTroveHealthResult>;
    getBorrowFeeFromEvent(txReceipt: GetTransactionReceiptResponse): [string, string];
    parseMaxBorrowFeePctWithCheck(borrowFeePct: string): Promise<bigint>;
    parseAssetBalanceInput(assetBalanceInput: AssetBalanceInput): Promise<AssetBalance>;
    prepareCollateralDeposits(collaterals: AssetBalancesInput): Promise<[AssetBalances, Call[]]>;
    openTroveTransaction(params: OpenTroveParams, agent: StarknetAgentInterface): Promise<OpenTroveResult>;
    depositTransaction(params: DepositTroveParams, agent: StarknetAgentInterface): Promise<DepositTroveResult>;
    withdrawTransaction(params: WithdrawTroveParams, agent: StarknetAgentInterface): Promise<WithdrawTroveResult>;
    borrowTransaction(params: BorrowTroveParams, agent: StarknetAgentInterface): Promise<BorrowTroveResult>;
    repayTransaction(params: RepayTroveParams, agent: StarknetAgentInterface): Promise<RepayTroveResult>;
}
export declare const createTroveManager: (agent: StarknetAgentInterface, walletAddress?: string) => TroveManager;
