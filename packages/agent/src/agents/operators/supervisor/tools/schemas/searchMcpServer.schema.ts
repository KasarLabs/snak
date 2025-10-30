import { z } from 'zod';
import { getGuardValue } from '@snakagent/core';

export const SearchMcpServerSchema = z.object({
  query: z
    .string()
    .max(getGuardValue('mcp.max_query_length'))
    .describe(
      'Human readable search query for MCP servers (e.g., "web search", "file management", "memory")'
    ),
  limit: z
    .number()
    .max(getGuardValue('mcp.max_limit_tools'))
    .optional()
    .describe('Maximum number of results to return (default: 10)'),
  deployedOnly: z
    .boolean()
    .optional()
    .describe('Only return deployed servers (default: false)'),
  verifiedOnly: z
    .boolean()
    .optional()
    .describe('Only return verified servers (default: false)'),
});

export type SearchMcpServerInput = z.infer<typeof SearchMcpServerSchema>;
