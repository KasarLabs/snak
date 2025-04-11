import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MCPConfigManager, MCP } from '../mcpConfig.js';
import { JsonConfig } from '../jsonConfig.js';

export const createMCPTools = (config: JsonConfig) => {
  const mcpManager = new MCPConfigManager(config);

  const searchMCPTool = new DynamicStructuredTool({
    name: 'search_mcp',
    description: 'Search for MCP servers on glama.ai',
    schema: z.object({
      query: z.string().describe('The search query for MCP servers'),
    }),
    func: async ({ query }) => {
      try {
        const servers = await mcpManager.searchMCP(query);
        return JSON.stringify(servers);
      } catch (error) {
        return `Error searching MCP servers: ${error}`;
      }
    },
  });

  const addMCPTool = new DynamicStructuredTool({
    name: 'add_mcp',
    description: 'Add a new MCP server to the configuration',
    schema: z.object({
      server: z.any().describe('The MCP server object to add'),
      env: z.record(z.string()).describe('Environment variables for the MCP server'),
    }),
    func: async ({ server, env }) => {
      try {
        await mcpManager.addMCP(server as MCP, env);
        return 'MCP server added successfully';
      } catch (error) {
        return `Error adding MCP server: ${error}`;
      }
    },
  });

  const removeMCPTool = new DynamicStructuredTool({
    name: 'remove_mcp',
    description: 'Remove a MCP server from the configuration',
    schema: z.object({
      serverName: z.string().describe('The name of the MCP server to remove'),
    }),
    func: async ({ serverName }) => {
      try {
        await mcpManager.removeMCP(serverName);
        return 'MCP server removed successfully';
      } catch (error) {
        return `Error removing MCP server: ${error}`;
      }
    },
  });

  return [searchMCPTool, addMCPTool, removeMCPTool];
}; 