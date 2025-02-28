import { Uint256 } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { RpcProvider } from 'starknet';
export declare const execute: (method: string, agent: StarknetAgentInterface, calldata: (string | Uint256)[], provider: RpcProvider) => Promise<{
    transaction_hash: string;
}>;
export declare const decimalsScale: (decimals: number) => string;
