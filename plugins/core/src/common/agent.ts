
import {RpcProvider} from 'starknet'
import { JsonConfig } from './jsonconfig.js';

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
    getTwitterAuthMode: () => 'API' | 'CREDENTIALS' | undefined;
    getAgentConfig: () => JsonConfig;
    getDatabase: () => PostgresAdaptater[];
    connectDatabase: (database_name: string) => Promise<void>;
    createDatabase: (
      database_name: string
    ) => Promise<PostgresAdaptater | undefined>;
    getDatabaseByName: (name: string) => PostgresAdaptater | undefined;
  }