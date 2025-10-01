import { z } from 'zod';
import {
  AgentProfileSchema,
  GraphConfigSchema,
  MemoryConfigSchema,
  RAGConfigSchema,
  McpServerConfigSchema,
} from './common.schemas.js';

// Schema for update agent - allows partial updates with nullable fields
export const UpdateAgentSchema = z.object({
  identifier: z
    .string()
    .describe(
      'The current agent ID or name to update (extract from user request, usually in quotes like "Ethereum RPC Agent")'
    ),
  searchBy: z
    .enum(['id', 'name'])
    .optional()
    .nullable()
    .describe(
      'Search by "id" when user provides an ID, or "name" when user provides agent name (default: name)'
    ),
  updates: z
    .object({
      profile: AgentProfileSchema.partial()
        .optional()
        .describe('Agent profile configuration (partial)'),
      mcp_servers: z
        .record(McpServerConfigSchema)
        .optional()
        .describe('MCP servers configuration'),
      plugins: z
        .array(z.string())
        .optional()
        .describe('List of plugins to attach to this agent'),
      memory: MemoryConfigSchema.optional().describe('Memory configuration'),
      rag: RAGConfigSchema.optional().describe('RAG configuration'),
      prompts_id: z
        .string()
        .uuid()
        .optional()
        .describe('Existing prompts configuration identifier'),
      graph: GraphConfigSchema.optional().describe('Graph configuration'),
    })
    .describe('Object containing only the fields that need to be updated'),
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
