export type AiConfig = {
    aiProviderApiKey: string;
    aiModel: string;
    aiProvider: string;
};
import { ProviderInterface, RpcProvider, TransactionReceipt, TransactionStatus } from 'starknet';
export interface BaseUtilityClass {
    provider: ProviderInterface;
}
export declare class TransactionMonitor implements BaseUtilityClass {
    provider: any;
    private readonly pollingInterval;
    constructor(provider: any, pollingInterval?: number);
    waitForTransaction(txHash: string, callback?: (status: TransactionStatus) => void): Promise<TransactionReceipt>;
    getTransactionEvents(txHash: string): Promise<Event[]>;
    watchEvents(fromBlock: number, toBlock: number | "latest" | undefined, callback: (events: Event[]) => void): Promise<void>;
    getTransactionStatus(txHash: string): Promise<TransactionStatus>;
}
import { Account, Contract, Call, EstimateFee } from 'starknet';
export interface ContractDeployResult {
    transactionHash: string;
    contractAddress: string | string[];
}
export interface TransactionResult {
    status: 'success' | 'failure';
    transactionHash?: string;
    contractAddress?: string;
    error?: string;
}
export declare class ContractInteractor implements BaseUtilityClass {
    provider: any;
    constructor(provider: any);
    deployContract(account: Account, classHash: string, constructorCalldata?: any[], salt?: string): Promise<ContractDeployResult>;
    estimateContractDeploy(account: Account, classHash: string, constructorCalldata?: any[], salt?: string): Promise<EstimateFee>;
    multicall(account: Account, calls: Call[]): Promise<TransactionResult>;
    estimateMulticall(account: Account, calls: Call[]): Promise<EstimateFee>;
    createContract(abi: any[], address: string, account?: Account): Contract;
    readContract(contract: Contract, method: string, args?: any[]): Promise<any>;
    writeContract(contract: Contract, method: string, args?: any[]): Promise<TransactionResult>;
    estimateContractWrite(contract: Contract, method: string, args?: any[]): Promise<EstimateFee>;
    formatTokenAmount(amount: string | number, decimals?: number): string;
    parseTokenAmount(amount: string, decimals?: number): string;
}
import { TwitterApi } from 'twitter-api-v2';
import { Scraper } from 'agent-twitter-client';
export interface TwitterApiConfig {
    twitter_api: string;
    twitter_api_secret: string;
    twitter_access_token: string;
    twitter_access_token_secret: string;
    twitter_api_client: TwitterApi;
}
export interface TwitterScraperConfig {
    twitter_client: Scraper;
    twitter_id: string;
    twitter_username: string;
}
export interface TwitterInterface {
    twitter_scraper?: TwitterScraperConfig;
    twitter_api?: TwitterApiConfig;
}
import TelegramBot from 'node-telegram-bot-api';
export interface TelegramInterface {
    bot_token?: string;
    public_url?: string;
    bot_port?: number;
    bot?: TelegramBot;
}
export interface IAgent {
    execute(input: string): Promise<unknown>;
    execute_call_data(input: string): Promise<unknown>;
    execute_autonomous(): Promise<unknown>;
    validateRequest(request: string): Promise<boolean>;
    getAccountCredentials(): {
        accountPrivateKey: string;
        accountPublicKey: string;
    };
    getModelCredentials(): {
        aiModel: string;
        aiProviderApiKey: string;
    };
    getProvider(): RpcProvider;
}
