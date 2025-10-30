import { BaseChatModel } from '@langchain/core/language_models/chat_models';

export type Modify<T, R> = Omit<T, keyof R> & R;

export interface ModelConfig {
  model_provider: string;
  model_name: string;
  description?: string;
  temperature: number;
  max_tokens: number;
}

/**
 * Agent profile configuration containing descriptive information
 */
export interface AgentProfile {
  name: string;
  group: string;
  description: string;
  contexts: string[];
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
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
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
    profile: AgentProfile;
    mcp_servers: Record<string, any>;
    memory: MemoryConfig;
    rag: RAGConfig;
  }

  /**
   * Input configuration for creating agents
   */
  export interface Input extends Base {
    prompts_id?: string;
    graph: GraphConfig;
  }

  /**
   * Input configuration with partial memory, mcp_servers and rag
   * Useful for updates where these configurations are optional
   */
  export interface InputWithPartialConfig
    extends Omit<Input, 'memory' | 'mcp_servers' | 'rag'> {
    memory?: Partial<MemoryConfig>;
    mcp_servers?: Record<string, any>;
    rag?: Partial<RAGConfig>;
  }

  /**
   * Input configuration with optional parameters for updates
   */
  export interface InputWithOptionalParam extends Partial<Input> {
    id: string;
    user_id?: string;
  }

  /**
   * Input configuration with ID for existing agents
   */
  export interface OutputWithId extends Input {
    id: string;
    prompts_id: string;
    user_id: string;
  }

  export interface Output extends OutputWithId {
    created_at: string;
    updated_at: string;
    avatar_mime_type?: string;
    avatar_image?: string;
  }

  export interface OutputWithoutUserId extends Omit<Output, 'user_id'> {
    user_id?: string;
  }

  /**
   * Runtime configuration with initialized/resolved data~
   */
  export interface Runtime extends Base {
    id: string;
    user_id: string;
    prompts: AgentPromptsInitialized<string>;
    graph: GraphConfigInitialized;
  }

  /**
   * Helper type for ID handling
   */
  export type WithOptionalId<HasId extends Id = Id.NoId> = HasId extends Id.Id
    ? OutputWithId
    : Input;
}

export interface DatabaseCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}
