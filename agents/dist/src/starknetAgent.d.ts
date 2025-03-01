import { IAgent } from '../common';
import { RpcProvider } from 'starknet';
import { TransactionMonitor } from '../common';
import { ContractInteractor } from '../common';
import { TwitterInterface } from '../common';
import { JsonConfig } from './jsonConfig';
import { TelegramInterface } from '../common';
export interface StarknetAgentConfig {
    aiProviderApiKey: string;
    aiModel: string;
    aiProvider: string;
    provider: RpcProvider;
    accountPublicKey: string;
    accountPrivateKey: string;
    signature: string;
    agentMode: string;
    agentconfig?: JsonConfig;
}
export declare class StarknetAgent implements IAgent {
    private readonly config;
    private readonly provider;
    private readonly accountPrivateKey;
    private readonly accountPublicKey;
    private readonly aiModel;
    private readonly aiProviderApiKey;
    private agentReactExecutor;
    private currentMode;
    private twitterAccoutManager;
    private telegramAccountManager;
    readonly transactionMonitor: TransactionMonitor;
    readonly contractInteractor: ContractInteractor;
    readonly signature: string;
    readonly agentMode: string;
    readonly agentconfig?: JsonConfig | undefined;
    constructor(config: StarknetAgentConfig);
    createAgentReactExecutor(): Promise<void>;
    private validateConfig;
    private switchMode;
    initializeTelegramManager(): Promise<void>;
    initializeTwitterManager(): Promise<void>;
    getAccountCredentials(): {
        accountPrivateKey: string;
        accountPublicKey: string;
    };
    getModelCredentials(): {
        aiModel: string;
        aiProviderApiKey: string;
    };
    getSignature(): {
        signature: string;
    };
    getAgent(): {
        agentMode: string;
    };
    getAgentConfig(): JsonConfig | undefined;
    getProvider(): RpcProvider;
    getTwitterAuthMode(): 'API' | 'CREDENTIALS' | undefined;
    getTwitterManager(): TwitterInterface;
    getTelegramManager(): TelegramInterface;
    validateRequest(request: string): Promise<boolean>;
    execute(input: string): Promise<unknown>;
    execute_autonomous(): Promise<unknown>;
    execute_call_data(input: string): Promise<unknown>;
}
