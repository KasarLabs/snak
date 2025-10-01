import { z } from 'zod';

// Schema for AgentProfile
export const AgentProfileSchema = z.object({
  name: z.string().min(1).describe('The display name of the agent'),
  group: z
    .string()
    .min(1)
    .describe('The functional group/category for the agent'),
  description: z
    .string()
    .min(1)
    .describe('A concise description of what the agent does'),
  contexts: z
    .array(z.string())
    .describe('Contextual strings for the agent profile'),
});

// Schema for ModelConfig
export const ModelConfigSchema = z.object({
  provider: z.string().optional().describe('Model provider'),
  model_name: z.string().optional().describe('Model name'),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe('Model temperature'),
  max_tokens: z.number().int().positive().optional().describe('Maximum tokens'),
});

// Schema for GraphConfig
export const GraphConfigSchema = z.object({
  max_steps: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum execution steps'),
  max_iterations: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum iterations'),
  max_retries: z.number().int().min(0).optional().describe('Maximum retries'),
  execution_timeout_ms: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Execution timeout in milliseconds'),
  max_token_usage: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum token usage'),
  model: ModelConfigSchema.optional().describe('Model configuration'),
});

// Schema for MemorySizeLimits
export const MemorySizeLimitsSchema = z.object({
  short_term_memory_size: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Short term memory size'),
  max_insert_episodic_size: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max insert episodic size'),
  max_insert_semantic_size: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max insert semantic size'),
  max_retrieve_memory_size: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max retrieve memory size'),
  limit_before_summarization: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Limit before summarization'),
});

// Schema for MemoryThresholds
export const MemoryThresholdsSchema = z.object({
  insert_semantic_threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Insert semantic threshold'),
  insert_episodic_threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Insert episodic threshold'),
  retrieve_memory_threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Retrieve memory threshold'),
  hitl_threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Human-in-the-loop threshold'),
});

// Schema for MemoryTimeouts
export const MemoryTimeoutsSchema = z.object({
  retrieve_memory_timeout_ms: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Retrieve memory timeout'),
  insert_memory_timeout_ms: z
    .number()
    .int()
    .positive()
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

// Schema for RAGConfig
export const RAGConfigSchema = z.object({
  enabled: z.boolean().optional().describe('RAG enabled'),
  top_k: z.number().int().positive().optional().describe('Top K for retrieval'),
});

// Schema for McpServerConfig
export const McpServerConfigSchema = z.object({
  command: z.string().optional().describe('MCP server command'),
  args: z.array(z.string()).optional().describe('MCP server arguments'),
  env: z
    .record(z.string())
    .optional()
    .describe('MCP server environment variables'),
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
