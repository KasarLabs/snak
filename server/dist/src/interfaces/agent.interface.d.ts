import { RpcProvider } from 'starknet';
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
