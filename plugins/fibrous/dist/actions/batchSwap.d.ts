import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { Router as FibrousRouter } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
import { BatchSwapParams } from '../types';
export declare class BatchSwapService {
    private agent;
    private walletAddress;
    private router;
    private tokenService;
    private approvalService;
    constructor(agent: StarknetAgentInterface, walletAddress: string, router: FibrousRouter);
    initialize(): Promise<void>;
    extractBatchSwapParams(params: BatchSwapParams): {
        sellTokenAddresses: string[];
        buyTokenAddresses: string[];
        sellAmounts: BigNumber[];
    };
    executeSwapTransaction(params: BatchSwapParams): Promise<{
        status: string;
        message: string;
        transactionHash: string;
        sellAmounts: number[] | BigNumber[];
        sellTokenSymbols: string[];
        buyTokenSymbols: string[];
        receipt: import("starknet").TransactionReceipt;
        events: Event[];
        error?: undefined;
    } | {
        status: string;
        error: string;
        message?: undefined;
        transactionHash?: undefined;
        sellAmounts?: undefined;
        sellTokenSymbols?: undefined;
        buyTokenSymbols?: undefined;
        receipt?: undefined;
        events?: undefined;
    }>;
    private monitorSwapStatus;
}
export declare const createSwapService: (agent: StarknetAgentInterface, walletAddress?: string) => BatchSwapService;
export declare const batchSwapTokens: (agent: StarknetAgentInterface, params: BatchSwapParams) => Promise<string>;
