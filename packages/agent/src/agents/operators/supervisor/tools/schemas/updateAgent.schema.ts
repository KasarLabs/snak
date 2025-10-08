import { z } from 'zod';
import {
  AgentProfileSchema,
  GraphConfigSchema,
  MemoryConfigSchema,
  RAGConfigSchema,
  McpServerConfigSchema,
} from './common.schemas.js';
import { getGuardValue } from '@snakagent/core';

const maxMcpServer = getGuardValue('agents.mcp_servers.max_servers');
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
    .default('name')
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
        .refine((obj) => Object.keys(obj).length <= maxMcpServer, {
          message: `MCP servers object must have at most ${maxMcpServer} keys`,
        })
        .optional()
        .describe('MCP servers configuration'),
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
