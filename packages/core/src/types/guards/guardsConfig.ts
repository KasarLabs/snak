/**
 * Configuration for global limits and constraints.
 */
export interface GlobalConfig {
  /**
   * Maximum number of users allowed in the system.
   */
  max_users: number;

  /**
   * Maximum number of agents allowed in the system.
   */
  max_agents: number;
}

/**
 * Configuration for user-specific limits.
 */
export interface UserConfig {
  /**
   * Maximum number of agents per user.
   */
  max_agents: number;

  /**
   * Maximum size for avatar uploads in bytes.
   */
  max_upload_avatar_size: number;

  /**
   * Maximum token usage limits for different tiers.
   */
  max_token_usage: number[];
}

/**
 * Configuration for execution limits.
 */
export interface ExecutionConfig {
  /**
   * Maximum number of steps in a plan.
   */
  max_plan_steps: number;

  /**
   * Maximum length for plan descriptions.
   */
  max_plan_description_length: number;

  /**
   * Maximum length for step names.
   */
  max_step_name_length: number;

  /**
   * Maximum length for step descriptions.
   */
  max_step_description_length: number;

  /**
   * Maximum number of parallel tools.
   */
  max_parallel_tools: number;

  /**
   * Maximum number of retry attempts.
   */
  max_retry_attempts: number;

  /**
   * Maximum length for messages.
   */
  max_message_length: number;
}

/**
 * Configuration for MCP (Model Context Protocol) limits.
 */
export interface McpConfig {
  /**
   * Maximum number of tools allowed.
   */
  max_limit_tools: number;

  /**
   * Maximum timeout in milliseconds.
   */
  max_timeout: number;
}

/**
 * Configuration for worker limits.
 */
export interface WorkerConfig {
  /**
   * Maximum number of workers.
   */
  max_worker: number;

  /**
   * Maximum number of file ingestion processes.
   */
  max_file_ingestion: number;

  /**
   * Maximum number of fallback workers.
   */
  max_fallback_worker: number;

  /**
   * Maximum queue size.
   */
  max_queue_size: number;
}

/**
 * Configuration for agent memory limits.
 */
export interface AgentMemoryConfig {
  /**
   * Maximum memory size.
   */
  memory_size_max: number;

  /**
   * Maximum short-term memory size.
   */
  short_term_memory_size_max: number;
}

/**
 * Configuration for agent plugins.
 */
export interface AgentPluginsConfig {
  /**
   * Maximum number of plugins.
   */
  max_size: number;

  /**
   * Maximum length for plugin names.
   */
  max_length: number;
}

/**
 * Configuration for MCP server arguments.
 */
export interface McpServerArgsConfig {
  /**
   * Maximum number of arguments.
   */
  max_size: number;

  /**
   * Maximum length for argument values.
   */
  max_length: number;
}

/**
 * Configuration for MCP server environment variables.
 */
export interface McpServerEnvConfig {
  /**
   * Maximum number of environment variables.
   */
  max_size: number;

  /**
   * Maximum length for environment variable values.
   */
  max_length: number;
}

/**
 * Configuration for MCP servers.
 */
export interface McpServersConfig {
  /**
   * Maximum number of servers.
   */
  max_servers: number;

  /**
   * Maximum length for server names.
   */
  max_server_name_length: number;

  /**
   * Maximum length for commands.
   */
  command_max_length: number;

  /**
   * Configuration for server arguments.
   */
  args: McpServerArgsConfig;

  /**
   * Configuration for server environment variables.
   */
  env: McpServerEnvConfig;
}

/**
 * Configuration for agents.
 */
export interface AgentsConfig {
  /**
   * Maximum length for agent names.
   */
  name_max_length: number;

  /**
   * Maximum length for agent descriptions.
   */
  description_max_length: number;

  /**
   * Maximum length for agent groups.
   */
  group_max_length: number;

  /**
   * Maximum interval value.
   */
  interval_max: number;

  /**
   * Maximum number of iterations.
   */
  max_iterations: number;

  /**
   * Memory configuration for agents.
   */
  memory: AgentMemoryConfig;

  /**
   * Maximum length for chat IDs.
   */
  chat_id_max_length: number;

  /**
   * Configuration for agent plugins.
   */
  plugins: AgentPluginsConfig;

  /**
   * Configuration for MCP servers.
   */
  mcp_servers: McpServersConfig;
}

/**
 * Configuration for models.
 */
export interface ModelConfig {
  /**
   * Maximum length for provider names.
   */
  provider_max_length: number;

  /**
   * Maximum length for model names.
   */
  model_name_max_length: number;

  /**
   * Maximum length for model descriptions.
   */
  description_max_length: number;
}

/**
 * Configuration for RAG (Retrieval-Augmented Generation).
 */
export interface GuardsRagConfig {
  /**
   * Maximum size for process data.
   */
  process_max_size: number;

  /**
   * Maximum size for agent data.
   */
  agent_max_size: number;

  /**
   * Maximum size for user data.
   */
  user_max_size: number;

  /**
   * Maximum size for RAG data.
   */
  max_size: number;
}

/**
 * Configuration for agent endpoints.
 */
export interface AgentEndpointsConfig {
  /**
   * Maximum token usage for updating agent MCP.
   */
  max_update_agent_mcp: number[];

  /**
   * Maximum token usage for updating agent configuration.
   */
  max_update_agent_config: number[];

  /**
   * Maximum token usage for uploading avatars.
   */
  max_upload_avatar: number[];

  /**
   * Maximum token usage for user requests.
   */
  max_user_request: number[];

  /**
   * Maximum token usage for stopping agents.
   */
  max_stop_agent: number[];

  /**
   * Maximum token usage for initializing agents.
   */
  max_init_agent: number[];

  /**
   * Maximum token usage for getting messages from agents.
   */
  max_get_message_from_agent: number[];

  /**
   * Maximum token usage for deleting agents.
   */
  max_delete_agent: number[];

  /**
   * Maximum token usage for getting messages from multiple agents.
   */
  max_get_messages_from_agents: number[];

  /**
   * Maximum token usage for clearing messages.
   */
  max_clear_message: number[];

  /**
   * Maximum token usage for getting agents.
   */
  max_get_agents: number[];

  /**
   * Maximum token usage for health checks.
   */
  max_health: number[];
}

/**
 * Configuration for file ingestion endpoints.
 */
export interface FileIngestionEndpointsConfig {
  /**
   * Maximum token usage for uploading files.
   */
  max_upload_file: number[];

  /**
   * Maximum token usage for listing files.
   */
  max_list_files: number[];

  /**
   * Maximum token usage for getting files.
   */
  max_get_file: number[];

  /**
   * Maximum token usage for deleting files.
   */
  max_delete_file: number[];
}

/**
 * Configuration for worker endpoints.
 */
export interface WorkersEndpointsConfig {
  /**
   * Maximum token usage for getting job status.
   */
  max_get_job_status: number[];

  /**
   * Maximum token usage for getting job results.
   */
  max_get_job_result: number[];

  /**
   * Maximum token usage for queue metrics.
   */
  max_queue_metrics: number[];
}

/**
 * Configuration for metrics endpoints.
 */
export interface MetricsEndpointsConfig {
  /**
   * Maximum token usage for getting metrics.
   */
  max_get_metrics: number[];
}

/**
 * Configuration for all endpoints.
 */
export interface EndpointsConfig {
  /**
   * Configuration for agent endpoints.
   */
  agent: AgentEndpointsConfig;

  /**
   * Configuration for file ingestion endpoints.
   */
  file_ingestion: FileIngestionEndpointsConfig;

  /**
   * Configuration for worker endpoints.
   */
  workers: WorkersEndpointsConfig;

  /**
   * Configuration for metrics endpoints.
   */
  metrics: MetricsEndpointsConfig;
}

/**
 * Main configuration structure for guards and limits.
 */
export interface GuardsConfig {
  /**
   * Global system limits.
   */
  global: GlobalConfig;

  /**
   * User-specific limits.
   */
  user: UserConfig;

  /**
   * Execution limits.
   */
  execution: ExecutionConfig;

  /**
   * MCP (Model Context Protocol) limits.
   */
  mcp: McpConfig;

  /**
   * Worker limits.
   */
  worker: WorkerConfig;

  /**
   * Agent configuration limits.
   */
  agents: AgentsConfig;

  /**
   * Model configuration limits.
   */
  model: ModelConfig;

  /**
   * RAG (Retrieval-Augmented Generation) limits.
   */
  rag: GuardsRagConfig;

  /**
   * Endpoint-specific limits.
   */
  endpoints: EndpointsConfig;
}
