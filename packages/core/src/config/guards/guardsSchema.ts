import { z } from 'zod';

/**
 * Zod schema for validating guards configuration.
 */

// Helper schemas for common validation patterns
const positiveInteger = z.number().int().positive();
const nonNegativeInteger = z.number().int().min(0);
const positiveIntegerArray = z.array(z.number().int().positive()).length(4);

// Global configuration schema
const GlobalConfigSchema = z.object({
  max_users: positiveInteger,
  max_agents: positiveInteger,
});

// User configuration schema
const UserConfigSchema = z.object({
  max_agents: positiveInteger,
  max_upload_avatar_size: positiveInteger,
  max_token_usage: positiveIntegerArray,
});

// Memory LTM configuration schema
const MemoryLtmConfigSchema = z.object({
  max_episodic_event_size: positiveInteger,
  max_semantic_fact_size: positiveInteger,
});

// Memory episodic event configuration schema
const MemoryEpisodicEventConfigSchema = z.object({
  max_content_length: positiveInteger,
  min_content_length: positiveInteger,
  max_source: positiveInteger,
  min_source: positiveInteger,
  name: z.object({
    max_length: positiveInteger,
    min_length: positiveInteger,
  }),
});

// Memory semantic fact configuration schema
const MemorySemanticFactConfigSchema = z.object({
  fact: z.object({
    max_length: positiveInteger,
    min_length: positiveInteger,
  }),
  category: z.object({
    max_length: positiveInteger,
    min_length: positiveInteger,
  }),
});

// Memory retrieve configuration schema
const MemoryRetrieveConfigSchema = z.object({
  top_k: z.object({
    max: positiveInteger,
    min: positiveInteger,
  }),
  max_threshold: z.number().min(0).max(1),
  max_limit: positiveInteger,
});

// Memory configuration schema
const MemoryConfigSchema = z.object({
  ltm: MemoryLtmConfigSchema,
  episodic_event: MemoryEpisodicEventConfigSchema,
  semantic_fact: MemorySemanticFactConfigSchema,
  retrieve: MemoryRetrieveConfigSchema,
});

// Execution configuration schema
const ExecutionConfigSchema = z.object({
  max_message_tokens: positiveInteger,
  max_retry_attempts: nonNegativeInteger,
  max_content_preview_length: positiveInteger,
  max_summary_length: positiveInteger,
  max_description_length: positiveInteger,
});

// Agent runtime cache configuration schema
const AgentRuntimeCacheConfigSchema = z.object({
  max_entries: positiveInteger,
  max_ttl_ms: positiveInteger,
});

// Agent runtime configuration schema
const AgentRuntimeConfigSchema = z.object({
  cache: AgentRuntimeCacheConfigSchema,
});

// Agent configuration worker schema
const AgentCfgWorkerConfigSchema = z.object({
  batch_size: positiveInteger,
  poll_interval_ms: positiveInteger,
});

// MCP configuration schema
const McpConfigSchema = z.object({
  max_limit_tools: positiveInteger,
  max_timeout: positiveInteger,
  max_query_length: positiveInteger,
  max_qualified_name_length: positiveInteger,
  max_server_name_length: positiveInteger,
  max_config_size: positiveInteger,
  max_profile_length: positiveInteger,
});

// Agent profile configuration schema
const AgentProfileConfigSchema = z.object({
  name_max_length: positiveInteger,
  name_min_length: positiveInteger,
  description_max_length: positiveInteger,
  description_min_length: positiveInteger,
  group_max_length: positiveInteger,
  group_min_length: positiveInteger,
  contexts_max_size: positiveInteger,
  context_max_length: positiveInteger,
  context_min_length: positiveInteger,
});

// MCP server arguments configuration schema
const McpServerArgsConfigSchema = z.object({
  max_size: positiveInteger,
  max_length: positiveInteger,
});

// MCP server environment configuration schema
const McpServerEnvConfigSchema = z.object({
  max_size: positiveInteger,
  max_length: positiveInteger,
});

// MCP servers configuration schema
const McpServersConfigSchema = z.object({
  max_servers: positiveInteger,
  max_server_name_length: positiveInteger,
  min_server_name_length: positiveInteger,
  command_max_length: positiveInteger,
  args: McpServerArgsConfigSchema,
  env: McpServerEnvConfigSchema,
});

// Agent graph model configuration schema
const AgentGraphModelConfigSchema = z.object({
  allowed_provider: z.string(),
  allowed_models: z.array(z.string()),
  max_temperature: z.number().min(0).max(1),
  max_tokens: positiveInteger,
});

// Agent graph configuration schema
const AgentGraphConfigSchema = z.object({
  max_steps: positiveInteger,
  min_steps: positiveInteger,
  max_iterations: positiveInteger,
  max_retries: positiveInteger,
  max_execution_timeout_ms: positiveInteger,
  max_token_usage: positiveInteger,
  model: AgentGraphModelConfigSchema,
});

// Agent memory size limits configuration schema
const AgentMemorySizeLimitsConfigSchema = z.object({
  max_short_term_memory_size: positiveInteger,
  max_insert_episodic_size: positiveInteger,
  max_insert_semantic_size: positiveInteger,
  max_retrieve_memory_size: positiveInteger,
  max_limit_before_summarization: positiveInteger,
});

// Agent memory thresholds configuration schema
const AgentMemoryThresholdsConfigSchema = z.object({
  max_insert_semantic_threshold: z.number().min(0).max(1),
  max_insert_episodic_threshold: z.number().min(0).max(1),
  max_retrieve_memory_threshold: z.number().min(0).max(1),
  max_hitl_threshold: z.number().min(0).max(1),
});

// Agent memory timeouts configuration schema
const AgentMemoryTimeoutsConfigSchema = z.object({
  max_retrieve_memory_timeout_ms: positiveInteger,
  max_insert_memory_timeout_ms: positiveInteger,
});

// Agent memory configuration schema
const AgentMemoryConfigSchema = z.object({
  size_limits: AgentMemorySizeLimitsConfigSchema,
  thresholds: AgentMemoryThresholdsConfigSchema,
  timeouts: AgentMemoryTimeoutsConfigSchema,
  strategy_max_length: positiveInteger,
  strategy_min_length: positiveInteger,
});

// Agent RAG configuration schema
const AgentRagConfigSchema = z.object({
  max_top_k: positiveInteger,
});

// Agents configuration schema
const AgentsConfigSchema = z.object({
  profile: AgentProfileConfigSchema,
  mcp_servers: McpServersConfigSchema,
  graph: AgentGraphConfigSchema,
  memory: AgentMemoryConfigSchema,
  rag: AgentRagConfigSchema,
});

// RAG configuration schema
const GuardsRagConfigSchema = z.object({
  process_max_size: positiveInteger,
  agent_max_size: positiveInteger,
  user_max_size: positiveInteger,
  max_size: positiveInteger,
  min_size: positiveInteger,
  max_original_name_length: positiveInteger,
  min_original_name_length: positiveInteger,
});

// Agent endpoints configuration schema
const AgentEndpointsConfigSchema = z.object({
  max_update_agent_mcp: positiveIntegerArray,
  max_update_agent_config: positiveIntegerArray,
  max_upload_avatar: positiveIntegerArray,
  max_user_request: positiveIntegerArray,
  max_stop_agent: positiveIntegerArray,
  max_init_agent: positiveIntegerArray,
  max_get_message_from_agent: positiveIntegerArray,
  max_delete_agent: positiveIntegerArray,
  max_get_messages_from_agents: positiveIntegerArray,
  max_clear_message: positiveIntegerArray,
  max_get_agents: positiveIntegerArray,
  max_health: positiveIntegerArray,
});

// File ingestion endpoints configuration schema
const FileIngestionEndpointsConfigSchema = z.object({
  max_upload_file: positiveIntegerArray,
  max_list_files: positiveIntegerArray,
  max_get_file: positiveIntegerArray,
  max_delete_file: positiveIntegerArray,
});

// Workers endpoints configuration schema
const WorkersEndpointsConfigSchema = z.object({
  max_get_job_status: positiveIntegerArray,
  max_get_job_result: positiveIntegerArray,
  max_queue_metrics: positiveIntegerArray,
});

// Metrics endpoints configuration schema
const MetricsEndpointsConfigSchema = z.object({
  max_get_metrics: positiveIntegerArray,
});

// Endpoints configuration schema
const EndpointsConfigSchema = z.object({
  agent: AgentEndpointsConfigSchema,
  file_ingestion: FileIngestionEndpointsConfigSchema,
  workers: WorkersEndpointsConfigSchema,
  metrics: MetricsEndpointsConfigSchema,
});

// Main guards configuration schema
export const GuardsConfigSchema = z.object({
  global: GlobalConfigSchema,
  user: UserConfigSchema,
  memory: MemoryConfigSchema,
  execution: ExecutionConfigSchema,
  agent_runtime: AgentRuntimeConfigSchema,
  agent_cfg_worker: AgentCfgWorkerConfigSchema,
  mcp: McpConfigSchema,
  agents: AgentsConfigSchema,
  rag: GuardsRagConfigSchema,
  endpoints: EndpointsConfigSchema,
});

// Type inference from the schema
export type GuardsConfig = z.infer<typeof GuardsConfigSchema>;
