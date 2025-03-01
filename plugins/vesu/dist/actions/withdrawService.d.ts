import { Call } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { Address, WithdrawParams, IBaseToken, IPool, ITokenValue, WithdrawResult } from '../interfaces';
import { Hex } from '../utils/num';
export declare class WithdrawEarnService {
    private agent;
    private walletAddress;
    constructor(agent: StarknetAgentInterface, walletAddress: string);
    getTokenPrice(token: IBaseToken, poolId: string, poolExtension: Hex): Promise<ITokenValue | undefined>;
    private getPoolAssetsPrice;
    private getPoolAssetsPriceAndRiskMdx;
    getPool(poolId: string): Promise<IPool>;
    getTokenBalance(baseToken: IBaseToken, walletAddress: Hex): Promise<bigint>;
    approveVTokenCalls(assetAddress: Address, vTokenAddress: Address, amount: bigint): Promise<Call>;
    withdrawEarnTransaction(params: WithdrawParams, agent: StarknetAgentInterface): Promise<WithdrawResult>;
}
export declare const withdrawService: (agent: StarknetAgentInterface, walletAddress?: string) => WithdrawEarnService;
export declare const withdrawEarnPosition: (agent: StarknetAgentInterface, params: WithdrawParams) => Promise<string>;
