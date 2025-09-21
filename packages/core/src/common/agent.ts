import { RpcProvider } from 'starknet';
import { SystemMessage } from '@langchain/core/messages';
import { z as Zod } from 'zod';

export interface StarknetTool<P = unknown> {
  name: string;
  plugins: string;
  description: string;
  schema?: Zod.AnyZodObject;
  responseFormat?: string;
  execute: (
    agent: SnakAgentInterface,
    params: P,
    plugins_manager?: any
  ) => Promise<unknown>;
}

/**
 * @interface SignatureTool
 * @description Interface for the signature tool
 * @property {string} name - The name of the tool
 * @property {string} category - The category of the tool
 * @property {string} description - The description of the tool
 * @property {object} schema - The schema for the tool
 * @property {(params: any) => Promise<unknown>} execute - Function to execute the tool
 */
export interface SignatureTool<P = any> {
  name: string;
  category?: string;
  description: string;
  schema?: object;
  execute: (params: P) => Promise<unknown>;
}

/**
 * Enum for the mode of operation of the agent
 */
export enum AgentMode {
  INTERACTIVE = 'interactive',
  AUTONOMOUS = 'autonomous',
  HYBRID = 'hybrid',
}

/**
 * Interface for the JSON configuration object
 */
export interface RawAgentConfig {
  name: string;
  group: string;
  user_id: string;
  description: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  interval: number;
  max_iterations: number;
  plugins: string[];
  memory: MemoryConfig;
  rag?: RagConfig;
  mcpServers?: Record<string, any>;
  mode: AgentMode;
}

export interface MemoryConfig {
  enabled?: boolean;
  shortTermMemorySize?: number;
  memorySize?: number;
  embeddingModel?: string;
  isAutonomous?: boolean;
}

export interface RagConfig {
  enabled?: boolean;
  topK?: number;
  embeddingModel?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  group: string;
  description: string;
  interval: number;
  chatId: string;
  plugins: string[];
  memory: MemoryConfig;
  rag?: RagConfig;
  mcpServers?: Record<string, any>;
  mode: AgentMode;
  maxIterations: number;
  prompt: SystemMessage;
}

export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * @interface SnakAgentInterface
 * @description Interface for the Starknet agent
 * @property {() => { accountPublicKey: string; accountPrivateKey: string; }} getAccountCredentials - Function to get the account credentials
 * @property {() => DatabaseCredentials} getDatabaseCredentials - Function to get the database credentials
 * @property {() => RpcProvider} getProvider - Function to get the provider
 * @property {() => AgentConfig} getAgentConfig - Function to get the agent configuration
 * @property {(database_name: string) => Promise<void>} connectDatabase - Function to connect to a database
 * @property {(database_name: string) => Promise<PostgresAdaptater | undefined>} createDatabase - Function to create a database
 * @property {(name: string) => PostgresAdaptater | undefined} getDatabaseByName - Function to get a database by name
 */
export interface SnakAgentInterface {
  getAccountCredentials: () => {
    accountPublicKey: string;
    accountPrivateKey: string;
  };
  getDatabaseCredentials: () => DatabaseCredentials;
  getProvider: () => RpcProvider;
  getAgentConfig: () => AgentConfig;
}
