import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { SwapParams, SwapResult } from '../types';
export declare class SwapService {
    private agent;
    private walletAddress;
    private tokenService;
    private approvalService;
    constructor(agent: StarknetAgentInterface, walletAddress: string);
    initialize(): Promise<void>;
    private safeStringify;
    private extractSpenderAddress;
    executeSwapTransaction(params: SwapParams, agent: StarknetAgentInterface): Promise<SwapResult>;
    private monitorSwapStatus;
}
export declare const createSwapService: (agent: StarknetAgentInterface, walletAddress?: string) => SwapService;
export declare const swapTokens: (agent: StarknetAgentInterface, params: SwapParams) => Promise<string>;
