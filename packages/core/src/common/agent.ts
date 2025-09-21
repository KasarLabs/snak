import { RpcProvider } from 'starknet';
import { SystemMessage } from '@langchain/core/messages';
import { z as Zod } from 'zod';
import { ModelConfig } from 'types/models/modelsConfig.js';

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
 * Agent profile configuration containing descriptive information
 */
export interface AgentProfile {
  description: string;
  group: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  mergedProfile?: string; // Don't set in the user request
}

/**
 * Prompt configuration for various agent tasks
 */
export interface AgentPrompts {
  taskMemoryManagerPromptId: string;
  taskExecutorPromptId: string;
  taskManagerPromptId: string;
  taskVerifierPromptId: string;
}

/**
 * Graph execution configuration
 */
export interface GraphConfig {
  maxSteps: number;
  maxIterations: number;
  maxRetries: number;
  executionTimeoutMs: number;
  maxTokenUsage: number;
  model: ModelConfig;
}

/**
 * Memory Strategy enum
 */
export enum MemoryStrategy {
  // Will be implemented later
  HOLISTIC = 'holistic', // Perfect for interactive agent or autonomus agent with a short-life
  CATEGORIZED = 'categorized', // Perfect for long-life autonomous agent
}

/**
 * Memory thresholds configuration
 */
export interface MemoryThresholds {
  insertSemanticThreshold: number;
  insertEpisodicThreshold: number;
  retrieveMemoryThreshold: number;
  summarizationThreshold: number;
}

/**
 * Memory size limits configuration
 */
export interface MemorySizeLimits {
  shortTermMemorySize: number;
  maxInsertEpisodicSize: number;
  maxInsertSemanticSize: number;
  maxRetrieveMemorySize: number;
}

/**
 * Memory timeout configuration
 */
export interface MemoryTimeouts {
  retrieveMemoryTimeoutMs: number;
  insertMemoryTimeoutMs: number;
}

/**
 * Memory configuration for the agent
 */
export interface MemoryConfig {
  ltmEnabled: boolean;
  summarizationThreshold: number;
  sizeLimits: MemorySizeLimits;
  thresholds: MemoryThresholds;
  timeouts: MemoryTimeouts;
  strategy: MemoryStrategy;
}

/**
 * RAG (Retrieval-Augmented Generation) configuration
 */
export interface RAGConfig {
  enabled?: boolean;
  topK?: number;
  embeddingModel?: string;
}

/**
 * Execution mode enumeration
 */
export enum AgentMode {
  AUTONOMOUS = 'autonomous',
  INTERACTIVE = 'interactive',
  HYBRID = 'hybrid',
}

export enum Id {
  NoId = 'NoId',
  Id = 'Id',
}
/**
 * Main agent configuration interface
 */
export interface AgentConfigBase {
  // Core identification
  // Agent Name
  name: string;
  // Group
  group: string;
  // Agent Profile
  profile: AgentProfile;
  // System configuration
  mode: AgentMode;
  // MCPs Servers configurations
  mcpServers: Record<string, any>;
  // Plugins configurations
  plugins: string[];
  // Prompt configurations
  prompts: AgentPrompts;
  // Graph execution settings
  graph: GraphConfig;
  // Memory settings
  memory: MemoryConfig;
  // RAG settings
  rag: RAGConfig;
}

export interface AgentConfigWithId extends AgentConfigBase {
  id: string;
}

export type AgentConfig<HasId extends Id = Id.NoId> = HasId extends Id.Id
  ? AgentConfigWithId
  : AgentConfigBase;

export interface StarknetConfig {
  provider: RpcProvider;
  accountPublicKey: string;
  accountPrivateKey: string;
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
