import { getGuardValue, GuardsConfig } from '@snakagent/core';
import { z } from 'zod';

const profileGuardsValues: GuardsConfig['agents']['profile'] =
  getGuardValue('agents.profile');
// Schema for AgentProfile
export const AgentProfileSchema = z.object({
  name: z
    .string()
    .min(profileGuardsValues.name_min_length)
    .max(profileGuardsValues.name_max_length)
    .describe('The display name of the agent'),
  group: z
    .string()
    .min(profileGuardsValues.group_min_length)
    .max(profileGuardsValues.group_max_length)
    .describe('The functional group/category for the agent'),
  description: z
    .string()
    .min(profileGuardsValues.description_min_length)
    .max(profileGuardsValues.description_max_length)
    .describe('A concise description of what the agent does'),
  contexts: z
    .array(
      z
        .string()
        .min(profileGuardsValues.context_min_length)
        .max(profileGuardsValues.context_max_length)
    )
    .max(profileGuardsValues.contexts_max_size)
    .describe('Contextual strings for the agent profile'),
});
const graphGuardsValues: GuardsConfig['agents']['graph'] =
  getGuardValue('agents.graph');
const modelGuardsValues: GuardsConfig['agents']['graph']['model'] =
  graphGuardsValues.model;
// Schema for ModelConfig
export const ModelConfigSchema = z.object({
  provider: z
    .string()
    .min(modelGuardsValues.provider_min_length)
    .max(modelGuardsValues.provider_max_length)
    .optional()
    .describe('Model provider'),
  model_name: z
    .string()
    .min(modelGuardsValues.model_name_min_length)
    .max(modelGuardsValues.model_name_max_length)
    .optional()
    .describe('Model name'),
  temperature: z
    .number()
    .positive()
    .max(modelGuardsValues.max_temperature)
    .optional()
    .describe('Model temperature'),
  max_tokens: z
    .number()
    .int()
    .positive()
    .max(modelGuardsValues.max_tokens)
    .optional()
    .describe('Maximum tokens'),
});

// Schema for GraphConfig
export const GraphConfigSchema = z.object({
  max_steps: z
    .number()
    .int()
    .positive()
    .max(graphGuardsValues.max_steps)
    .optional()
    .describe('Maximum execution steps'),
  max_iterations: z
    .number()
    .int()
    .positive()
    .max(graphGuardsValues.max_iterations)
    .optional()
    .describe('Maximum iterations'),
  max_retries: z.number().int().min(0).optional().describe('Maximum retries'),
  execution_timeout_ms: z
    .number()
    .int()
    .positive()
    .max(graphGuardsValues.max_execution_timeout_ms)
    .optional()
    .describe('Execution timeout in milliseconds'),
  max_token_usage: z
    .number()
    .int()
    .max(graphGuardsValues.max_token_usage)
    .positive()
    .optional()
    .describe('Maximum token usage'),
  model: ModelConfigSchema.optional().describe('Model configuration'),
});
const memoryGuardsValues: GuardsConfig['agents']['memory'] =
  getGuardValue('agents.memory');
// Schema for MemorySizeLimits
export const MemorySizeLimitsSchema = z.object({
  short_term_memory_size: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.size_limits.max_short_term_memory_size)
    .optional()
    .describe('Short term memory size'),
  max_insert_episodic_size: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.size_limits.max_insert_episodic_size)
    .optional()
    .describe('Max insert episodic size'),
  max_insert_semantic_size: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.size_limits.max_insert_semantic_size)
    .optional()
    .describe('Max insert semantic size'),
  max_retrieve_memory_size: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.size_limits.max_retrieve_memory_size)
    .optional()
    .describe('Max retrieve memory size'),
  limit_before_summarization: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.size_limits.max_limit_before_summarization)
    .optional()
    .describe('Limit before summarization'),
});

// Schema for MemoryThresholds
export const MemoryThresholdsSchema = z.object({
  insert_semantic_threshold: z
    .number()
    .positive()
    .max(memoryGuardsValues.thresholds.max_insert_semantic_threshold)
    .optional()
    .describe('Insert semantic threshold'),
  insert_episodic_threshold: z
    .number()
    .positive()
    .max(memoryGuardsValues.thresholds.max_insert_episodic_threshold)
    .optional()
    .describe('Insert episodic threshold'),
  retrieve_memory_threshold: z
    .number()
    .positive()
    .max(memoryGuardsValues.thresholds.max_retrieve_memory_threshold)
    .optional()
    .describe('Retrieve memory threshold'),
  hitl_threshold: z
    .number()
    .positive()
    .max(memoryGuardsValues.thresholds.max_hitl_threshold)
    .optional()
    .describe('Human-in-the-loop threshold'),
});

// Schema for MemoryTimeouts
export const MemoryTimeoutsSchema = z.object({
  retrieve_memory_timeout_ms: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.timeouts.max_retrieve_memory_timeout_ms)
    .optional()
    .describe('Retrieve memory timeout'),
  insert_memory_timeout_ms: z
    .number()
    .int()
    .positive()
    .max(memoryGuardsValues.timeouts.max_insert_memory_timeout_ms)
    .optional()
    .describe('Insert memory timeout'),
});

// Schema for MemoryConfig
export const MemoryConfigSchema = z.object({
  ltm_enabled: z.boolean().optional().describe('Long-term memory enabled'),
  size_limits: MemorySizeLimitsSchema.optional().describe('Memory size limits'),
  thresholds: MemoryThresholdsSchema.optional().describe('Memory thresholds'),
  timeouts: MemoryTimeoutsSchema.optional().describe('Memory timeouts'),
  strategy: z
    .enum(['holistic', 'categorized'])
    .optional()
    .describe('Memory strategy'),
});
const ragGuardsValues: GuardsConfig['agents']['rag'] =
  getGuardValue('agents.rag');
// Schema for RAGConfig
export const RAGConfigSchema = z.object({
  enabled: z.boolean().optional().describe('RAG enabled'),
  top_k: z
    .number()
    .int()
    .positive()
    .max(ragGuardsValues.max_top_k)
    .optional()
    .describe('Top K for retrieval'),
});
const mcpServersGuardsValues: GuardsConfig['agents']['mcp_servers'] =
  getGuardValue('agents.mcp_servers');
// Schema for McpServerConfig
export const McpServerConfigSchema = z.object({
  command: z
    .string()
    .max(mcpServersGuardsValues.command_max_length)
    .optional()
    .describe('MCP server command'),
  args: z
    .array(z.string().max(mcpServersGuardsValues.args.max_length))
    .max(mcpServersGuardsValues.args.max_size)
    .optional()
    .describe('MCP server arguments'),
  env: z
    .record(z.string().max(mcpServersGuardsValues.env.max_length))
    .refine(
      (obj) => Object.keys(obj).length <= mcpServersGuardsValues.env.max_size,
      {
        message: `Environment variables object must have at most ${mcpServersGuardsValues.env.max_size} keys`,
      }
    )
    .optional()
    .describe('MCP server environment variables'),
});

// Schema for MCP servers record with validation for server names (keys)
export const McpServersRecordSchema = z
  .record(McpServerConfigSchema)
  .refine(
    (obj) => Object.keys(obj).length <= mcpServersGuardsValues.max_servers,
    {
      message: `MCP servers object must have at most ${mcpServersGuardsValues.max_servers} keys`,
    }
  )
  .refine(
    (obj) =>
      Object.keys(obj).every(
        (key) =>
          key.length >= mcpServersGuardsValues.min_server_name_length &&
          key.length <= mcpServersGuardsValues.max_server_name_length
      ),
    {
      message: `MCP server names must be between ${mcpServersGuardsValues.min_server_name_length} and ${mcpServersGuardsValues.max_server_name_length} characters`,
    }
  );
// Schema for PromptsConfig
export const PromptsConfigSchema = z.object({
  id: z
    .string()
    .max(getGuardValue('agents.prompts_id_max_length'))
    .optional()
    .describe('Prompts ID'),
});

// Schema for selecting an agent
export const SelectAgentSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The agent ID or name to select (extract exact name from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .default('name')
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
});

// Type exports for convenience
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type GraphConfig = z.infer<typeof GraphConfigSchema>;
export type MemorySizeLimits = z.infer<typeof MemorySizeLimitsSchema>;
export type MemoryThresholds = z.infer<typeof MemoryThresholdsSchema>;
export type MemoryTimeouts = z.infer<typeof MemoryTimeoutsSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type RAGConfig = z.infer<typeof RAGConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;
export type McpServersRecord = z.infer<typeof McpServersRecordSchema>;
export type SelectAgent = z.infer<typeof SelectAgentSchema>;
