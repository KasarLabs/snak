import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { Router as FibrousRouter } from 'fibrous-router-sdk';
import { SwapResult, SwapParams } from '../types';
export declare class SwapService {
    private agent;
    private walletAddress;
    private router;
    private tokenService;
    private approvalService;
    constructor(agent: StarknetAgentInterface, walletAddress: string, router: FibrousRouter);
    initialize(): Promise<void>;
    executeSwapTransaction(params: SwapParams): Promise<SwapResult>;
    private monitorSwapStatus;
}
export declare const createSwapService: (agent: StarknetAgentInterface, walletAddress?: string) => SwapService;
export declare const swapTokensFibrous: (agent: StarknetAgentInterface, params: SwapParams) => Promise<string>;
