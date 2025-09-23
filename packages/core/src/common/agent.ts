import { RpcProvider } from 'starknet';
import { SystemMessage } from '@langchain/core/messages';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z as Zod } from 'zod';

export type Modify<T, R> = Omit<T, keyof R> & R;

export interface StarknetTool<P = unknown> {
  name: string;
  plugins: string;
  description: string;
  schema?: Zod.AnyZodObject;
  response_format?: string;
  execute: (agent: any, params: P, plugins_manager?: any) => Promise<unknown>;
}

export interface ModelConfig {
  provider: string;
  model_name: string;
  description?: string;
  temperature: number;
  max_tokens: number;
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
  agent_config_prompt?: string; // Don't set in the user request
}

/**
 * Prompt configuration for various agent tasks
 */
export interface AgentPrompts {
  id: string;
}

export interface AgentPromptsInitialized<T> {
  task_memory_manager_prompt: T;
  task_executor_prompt: T;
  task_manager_prompt: T;
  task_verifier_prompt: T;
  // Add resolved prompts or other runtime data as needed
}

/**
 * Graph execution configuration
 */
export interface GraphConfig {
  max_steps: number;
  max_iterations: number;
  max_retries: number;
  execution_timeout_ms: number;
  max_token_usage: number;
  model: ModelConfig;
}

/**
 * Initialized graph configuration with runtime data
 */
export type GraphConfigInitialized = Modify<
  GraphConfig,
  {
    model: BaseChatModel;
  }
>;

/**
 *
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
  insert_semantic_threshold: number;
  insert_episodic_threshold: number;
  retrieve_memory_threshold: number;
  hitl_threshold: number;
}

/**
 * Memory size limits configuration
 */
export interface MemorySizeLimits {
  short_term_memory_size: number;
  max_insert_episodic_size: number;
  max_insert_semantic_size: number;
  max_retrieve_memory_size: number;
  limit_before_summarization: number;
}

/**
 * Memory timeout configuration
 */
export interface MemoryTimeouts {
  retrieve_memory_timeout_ms: number;
  insert_memory_timeout_ms: number;
}

/**
 * Memory configuration for the agent
 */
export interface MemoryConfig {
  ltm_enabled: boolean;
  size_limits: MemorySizeLimits;
  thresholds: MemoryThresholds;
  timeouts: MemoryTimeouts;
  strategy: MemoryStrategy;
}

/**
 * RAG (Retrieval-Augmented Generation) configuration
 */
export interface RAGConfig {
  enabled?: boolean;
  top_k?: number;
  embedding_model?: string;
}

export enum Id {
  NoId = 'NoId',
  Id = 'Id',
}
/**
 * Agent configuration namespace providing clean separation between input and runtime types
 */
export namespace AgentConfig {
  /**
   * Base configuration properties shared across all agent config types
   */
  interface Base {
    name: string;
    group: string;
    profile: AgentProfile;
    mcp_servers: Record<string, any>;
    plugins: string[];
    memory: MemoryConfig;
    rag: RAGConfig;
  }

  /**
   * Input configuration for creating/updating agents
   */
  export interface Input extends Base {
    prompts?: AgentPrompts;
    graph: GraphConfig;
  }

  /**
   * Input configuration with ID for existing agents
   */
  export interface InputWithId extends Input {
    id: string;
    prompts: AgentPrompts;
    user_id: string;
  }

  /**
   * Runtime configuration with initialized/resolved data~
   */
  export interface Runtime extends Base {
    id: string;
    user_id: string;
    prompts: AgentPromptsInitialized<SystemMessage>;
    graph: GraphConfigInitialized;
  }

  /**
   * Helper type for ID handling
   */
  export type WithOptionalId<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? InputWithId
    : Input;
}

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

// TODO REMOVE WHEN REMOVED PLUGINS
/**
 * @interface SnakAgentInterface
 * @description Interface for the Starknet agent
 * @property {() => { accountPublicKey: string; accountPrivateKey: string; }} getAccountCredentials - Function to get the account credentials
 * @property {() => DatabaseCredentials} getDatabaseCredentials - Function to get the database credentials
 * @property {() => RpcProvider} getProvider - Function to get the provider
 * @property {() => AgentConfigInput} getAgentConfig - Function to get the agent configuration
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
  getAgentConfig: () => AgentConfig.Input;
}
