import { z } from 'zod';
import {
  AgentProfileSchema,
  GraphConfigSchema,
  MemoryConfigSchema,
  RAGConfigSchema,
  McpServerConfigSchema,
  SelectAgentSchema,
  McpServersArraySchema,
} from './common.schemas.js';
import { getGuardValue } from '@snakagent/core';

const maxMcpServer = getGuardValue('agents.mcp_servers.max_servers');
// Schema for update agent - allows partial updates with nullable fields
export const UpdateAgentSchema = SelectAgentSchema.extend({
  updates: z
    .object({
      profile: AgentProfileSchema.partial()
        .optional()
        .describe('Agent profile configuration (partial)'),
      mcp_servers: McpServersArraySchema.optional().describe(
        'MCP servers configuration'
      ),
      memory: MemoryConfigSchema.partial()
        .optional()
        .describe('Memory configuration'),
      rag: RAGConfigSchema.partial().optional().describe('RAG configuration'),
      graph: GraphConfigSchema.partial()
        .optional()
        .describe('Graph configuration'),
    })
    .describe('Object containing only the fields that need to be updated'),
});

export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;
