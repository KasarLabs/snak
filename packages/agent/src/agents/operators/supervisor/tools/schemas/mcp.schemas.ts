import z from 'zod';
import { McpServersRecordSchema, SelectAgentSchema } from './common.schemas.js';
import { getGuardValue } from '@snakagent/core';

export const AddMcpServerSchema = SelectAgentSchema.extend({
  mcp_servers: McpServersRecordSchema,
});

export const RemoveMcpServerSchema = SelectAgentSchema.extend({
  serverNames: z
    .array(
      z
        .string()
        .min(getGuardValue('agents.mcp_servers.min_server_name_length'))
        .max(getGuardValue('agents.mcp_servers.max_server_name_length'))
    )
    .min(1)
    .max(getGuardValue('agents.mcp_servers.max_servers'))
    .describe('The names/identifiers of the MCP servers to remove'),
});

export const UpdateMcpServerSchema = SelectAgentSchema.extend({
  mcp_servers: McpServersRecordSchema,
});
