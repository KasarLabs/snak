import { RpcProvider } from 'starknet';
import { TransactionMonitor } from '../../common';
import { ContractInteractor } from '../../common';
import { TwitterInterface } from '../../common';
import { JsonConfig } from '../jsonConfig';
import { TelegramInterface } from '../../common';
export interface StarknetAgentInterface {
    getAccountCredentials: () => {
        accountPublicKey: string;
        accountPrivateKey: string;
    };
    getModelCredentials: () => {
        aiModel: string;
        aiProviderApiKey: string;
    };
    getSignature: () => {
        signature: string;
    };
    getProvider: () => RpcProvider;
    transactionMonitor: TransactionMonitor;
    contractInteractor: ContractInteractor;
    getTwitterAuthMode: () => 'API' | 'CREDENTIALS' | undefined;
    getAgentConfig: () => JsonConfig | undefined;
    getTwitterManager: () => TwitterInterface;
    getTelegramManager: () => TelegramInterface;
}
export interface StarknetTool<P = any> {
    name: string;
    plugins: string;
    description: string;
    schema?: object;
    responseFormat?: string;
    execute: (agent: StarknetAgentInterface, params: P, plugins_manager?: any) => Promise<unknown>;
}
export declare class StarknetToolRegistry {
    private static tools;
    static registerTool<P>(tool: StarknetTool<P>): void;
    static createTools(agent: StarknetAgentInterface): import("@langchain/core/tools").DynamicStructuredTool<any>[];
    static createAllowedTools(agent: StarknetAgentInterface, allowed_tools: string[]): Promise<import("@langchain/core/tools").DynamicStructuredTool<any>[]>;
}
export declare const initializeTools: (agent: StarknetAgentInterface) => void;
export declare const registerTools: (agent: StarknetAgentInterface, allowed_tools: string[], tools: StarknetTool[]) => Promise<void>;
export declare const createTools: (agent: StarknetAgentInterface) => import("@langchain/core/tools").DynamicStructuredTool<any>[];
export declare const createAllowedTools: (agent: StarknetAgentInterface, allowed_tools: string[]) => Promise<import("@langchain/core/tools").DynamicStructuredTool<any>[]>;
export default StarknetToolRegistry;
