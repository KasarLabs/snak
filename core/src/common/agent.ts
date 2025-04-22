import { RpcProvider } from 'starknet';
import { SystemMessage } from '@langchain/core/messages';
import { Postgres } from '@hijox/database';
export interface StarknetTool<P = unknown> {
  name: string;
  plugins: string;
  description: string;
  schema?: Zod.AnyZodObject;
  responseFormat?: string;
  execute: (
    agent: StarknetAgentInterface,
    params: P,
    plugins_manager?: any
  ) => Promise<unknown>;
}

/**
 * @interface SignatureTool
 * @description Interface for the signature tool
 * @property {string} name - The name of the tool
 * @property {string} categorie - The categorie of the tool
 * @property {string} description - The description of the tool
 * @property {object} schema - The schema for the tool
 * @property {(params: any) => Promise<unknown>} execute - Function to execute the tool
 */
export interface SignatureTool<P = any> {
  name: string;
  categorie?: string;
  description: string;
  schema?: object;
  execute: (params: P) => Promise<unknown>;
}

export interface ModeConfig {
  interactive: boolean;
  autonomous: boolean;
  recursionLimit: number;
}

/**
 * Interface for the JSON configuration object
 */
export interface JsonConfig {
  name: string;
  prompt: SystemMessage;
  interval: number;
  chat_id: string;
  plugins: string[];
  memory: boolean;
  mcpServers?: Record<string, any>;
  mode: ModeConfig;
}

export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * @interface StarknetAgentInterface
 * @description Interface for the Starknet agent
 * @property {() => { accountPublicKey: string; accountPrivateKey: string; }} getAccountCredentials - Function to get the account credentials
 * @property {() => { aiModel: string; aiProviderApiKey: string; }} getModelCredentials - Function to get the model credentials
 * @property {() => DatabaseCredentials} getDatabaseCredentials - Function to get the database credentials
 * @property {() => { signature: string; }} getSignature - Function to get the signature
 * @property {() => RpcProvider} getProvider - Function to get the provider
 * @property {() => JsonConfig} getAgentConfig - Function to get the agent configuration
 * @property {() => PostgresAdaptater[]} getDatabase - Function to get the database
 * @property {(database_name: string) => Promise<void>} connectDatabase - Function to connect to a database
 * @property {(database_name: string) => Promise<PostgresAdaptater | undefined>} createDatabase - Function to create a database
 * @property {(name: string) => PostgresAdaptater | undefined} getDatabaseByName - Function to get a database by name
 */
export interface StarknetAgentInterface {
  getAccountCredentials: () => {
    accountPublicKey: string;
    accountPrivateKey: string;
  };
  getModelCredentials: () => {
    aiModel: string;
    aiProviderApiKey: string;
  };
  getDatabaseCredentials: () => DatabaseCredentials;
  getSignature: () => {
    signature: string;
  };
  getProvider: () => RpcProvider;
  getAgentConfig: () => JsonConfig | undefined;
  getDatabase: () => Map<string, Postgres>;
  setDatabase: (databases: Map<string, Postgres>) => void;
}
