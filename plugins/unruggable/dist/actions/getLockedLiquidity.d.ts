import { ContractAddressParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
type LiquidityType = {
    type: 'JediERC20';
    address: string;
} | {
    type: 'StarkDeFiERC20';
    address: string;
} | {
    type: 'EkuboNFT';
    tokenId: number;
};
interface LockedLiquidityInfo {
    hasLockedLiquidity: boolean;
    liquidityType?: LiquidityType;
    liquidityContractAddress?: string;
}
export declare const getLockedLiquidity: (agent: StarknetAgentInterface, params: ContractAddressParams) => Promise<{
    status: string;
    data: LockedLiquidityInfo;
    error?: undefined;
} | {
    status: string;
    error: any;
    data?: undefined;
}>;
export {};
