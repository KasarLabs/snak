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

// Execution graph plan configuration schema
const ExecutionGraphPlanConfigSchema = z.object({
  max_steps: positiveInteger,
  min_steps: positiveInteger,
  max_summary_length: positiveInteger,
});

// Execution graph step configuration schema
const ExecutionGraphStepConfigSchema = z.object({
  max_steps: positiveInteger,
  min_steps: positiveInteger,
  max_name_length: positiveInteger,
  min_name_length: positiveInteger,
  max_description_length: positiveInteger,
  max_parallel_tools: positiveInteger,
});

// Execution graph tools configuration schema
const ExecutionGraphToolsConfigSchema = z.object({
  max_description_length: positiveInteger,
  max_required_length: positiveInteger,
  max_expected_result_length: positiveInteger,
  max_result_length: positiveInteger,
});

// Execution graph result schema configuration
const ExecutionGraphResultSchemaConfigSchema = z.object({
  max_content_length: positiveInteger,
  max_tokens: positiveInteger,
});

// Execution graph memory configuration schema
const ExecutionGraphMemoryConfigSchema = z.object({
  max_timeout: positiveInteger,
  max_wait_time: positiveInteger,
  max_content_length: positiveInteger,
});

// Execution graph configuration schema
const ExecutionGraphConfigSchema = z.object({
  plan: ExecutionGraphPlanConfigSchema,
  step: ExecutionGraphStepConfigSchema,
  tools: ExecutionGraphToolsConfigSchema,
  result_schema: ExecutionGraphResultSchemaConfigSchema,
  memory: ExecutionGraphMemoryConfigSchema,
});

// Memory LTM configuration schema
const MemoryLtmConfigSchema = z.object({
  max_episodic_event_size: positiveInteger,
  max_semantic_fact_size: positiveInteger,
});

// Memory episodic event configuration schema
const MemoryEpisodicEventConfigSchema = z.object({
  max_name_length: positiveInteger,
  min_name_length: positiveInteger,
  max_content_length: positiveInteger,
  min_content_length: positiveInteger,
  max_source: positiveInteger,
});

// Memory semantic fact configuration schema
const MemorySemanticFactConfigSchema = z.object({
  fact: z.object({
    max_length: positiveInteger,
    min_length: positiveInteger,
  }),
  category: z.object({
    max_length: positiveInteger,
  }),
});

// Memory configuration schema
const MemoryConfigSchema = z.object({
  ltm: MemoryLtmConfigSchema,
  episodic_event: MemoryEpisodicEventConfigSchema,
  semantic_fact: MemorySemanticFactConfigSchema,
});

// Execution configuration schema
const ExecutionConfigSchema = z.object({
  max_message_tokens: positiveInteger,
  max_retry_attempts: nonNegativeInteger,
  max_content_preview_length: positiveInteger,
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

// Agent memory configuration schema
const AgentMemoryConfigSchema = z.object({
  memory_size_max: positiveInteger,
  memory_size_min: nonNegativeInteger,
  short_term_memory_size_max: positiveInteger,
  short_term_memory_size_min: nonNegativeInteger,
});

// Agent plugins configuration schema
const AgentPluginsConfigSchema = z.object({
  max_size: positiveInteger,
  min_size: nonNegativeInteger,
  max_length: positiveInteger,
  min_length: positiveInteger,
});

// MCP server arguments configuration schema
const McpServerArgsConfigSchema = z.object({
  max_size: positiveInteger,
  min_size: nonNegativeInteger,
  max_length: positiveInteger,
  min_length: positiveInteger,
});

// MCP server environment configuration schema
const McpServerEnvConfigSchema = z.object({
  max_size: positiveInteger,
  min_size: nonNegativeInteger,
  max_length: positiveInteger,
  min_length: positiveInteger,
});

// MCP servers configuration schema
const McpServersConfigSchema = z.object({
  max_servers: positiveInteger,
  min_servers: nonNegativeInteger,
  max_server_name_length: positiveInteger,
  min_server_name_length: positiveInteger,
  command_max_length: positiveInteger,
  min_command_length: nonNegativeInteger,
  args: McpServerArgsConfigSchema,
  env: McpServerEnvConfigSchema,
});

// Agents configuration schema
const AgentsConfigSchema = z.object({
  name_max_length: positiveInteger,
  name_min_length: positiveInteger,
  description_max_length: positiveInteger,
  description_min_length: positiveInteger,
  group_max_length: positiveInteger,
  group_min_length: positiveInteger,
  interval_max: positiveInteger,
  interval_min: positiveInteger,
  max_max_iterations: positiveInteger,
  min_max_iterations: positiveInteger,
  memory: AgentMemoryConfigSchema,
  chat_id_max_length: positiveInteger,
  chat_id_min_length: positiveInteger,
  plugins: AgentPluginsConfigSchema,
  mcp_servers: McpServersConfigSchema,
});

// Model configuration schema
const ModelConfigSchema = z.object({
  provider_max_length: positiveInteger,
  model_name_max_length: positiveInteger,
  description_max_length: positiveInteger,
});

// RAG configuration schema
const GuardsRagConfigSchema = z.object({
  process_max_size: positiveInteger,
  agent_max_size: positiveInteger,
  user_max_size: positiveInteger,
  rag_max_size: positiveInteger,
  rag_min_size: positiveInteger,
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
  execution_graph: ExecutionGraphConfigSchema,
  memory: MemoryConfigSchema,
  execution: ExecutionConfigSchema,
  mcp: McpConfigSchema,
  agents: AgentsConfigSchema,
  model: ModelConfigSchema,
  rag: GuardsRagConfigSchema,
  endpoints: EndpointsConfigSchema,
});

// Type inference from the schema
export type GuardsConfig = z.infer<typeof GuardsConfigSchema>;
