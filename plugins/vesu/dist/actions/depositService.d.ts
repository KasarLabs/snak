import { Call } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { Address, DepositParams, DepositResult, IBaseToken, IPool, ITokenValue } from '../interfaces';
import { Hex } from '../utils/num';
export declare class DepositEarnService {
    private agent;
    private walletAddress;
    constructor(agent: StarknetAgentInterface, walletAddress: string);
    getTokenPrice(token: IBaseToken, poolId: string, poolExtension: Hex): Promise<ITokenValue | undefined>;
    private getPoolAssetsPrice;
    private getPoolAssetsPriceAndRiskMdx;
    getPool(poolId: string): Promise<IPool>;
    approveVTokenCalls(assetAddress: Address, vTokenAddress: Address, amount: bigint): Promise<Call>;
    depositEarnTransaction(params: DepositParams, agent: StarknetAgentInterface): Promise<DepositResult>;
}
export declare const createDepositEarnService: (agent: StarknetAgentInterface, walletAddress?: string) => DepositEarnService;
export declare const depositEarnPosition: (agent: StarknetAgentInterface, params: DepositParams) => Promise<string>;
