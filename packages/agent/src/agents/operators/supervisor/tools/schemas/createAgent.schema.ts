import { z } from 'zod';
import {
  AgentProfileSchema,
  GraphConfigSchema,
  MemoryConfigSchema,
  RAGConfigSchema,
  McpServersArraySchema,
} from './common.schemas.js';

// Main schema for creating an agent (profile required, other fields optional)
export const CreateAgentSchema = z
  .object({
    profile: AgentProfileSchema.describe('Agent profile configuration'),
    mcp_servers: McpServersArraySchema.optional().describe(
      'MCP servers configuration'
    ),
    memory: MemoryConfigSchema.optional().describe('Memory configuration'),
    rag: RAGConfigSchema.optional().describe('RAG configuration'),
    prompts_id: z
      .string()
      .uuid()
      .optional()
      .describe('Existing prompts configuration identifier'),
    graph: GraphConfigSchema.optional().describe('Graph configuration'),
  })
  .strict();

export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
