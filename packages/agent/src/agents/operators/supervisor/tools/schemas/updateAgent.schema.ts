import { z } from 'zod';
import {
  AgentProfileSchema,
  GraphConfigSchema,
  MemoryConfigSchema,
  RAGConfigSchema,
  SelectAgentSchema,
} from './common.schemas.js';

// Schema for update agent - allows partial updates with nullable fields
// Note: mcp_servers is NOT included here - use add_mcp_server, update_mcp_server, or remove_mcp_server tools instead
export const UpdateAgentSchema = SelectAgentSchema.extend({
  updates: z
    .object({
      profile: AgentProfileSchema.partial()
        .optional()
        .describe('Agent profile configuration (partial)'),
      memory: MemoryConfigSchema.optional().describe('Memory configuration'),
      rag: RAGConfigSchema.optional().describe('RAG configuration'),
      graph: GraphConfigSchema.partial()
        .optional()
        .describe('Graph configuration'),
    })
    .describe('Object containing only the fields that need to be updated'),
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
