import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RpcProvider } from 'starknet';
import { SnakAgent, registerTools, StarknetTool } from '@snakagent/agents';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { AgentConfig } from '@snakagent/core';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const defaultAgentConfigPath = path.join(
  __dirname,
  '../../../config/agent/default.agent.json'
);
let defaultAgentConfig = {};
try {
  const configData = fs.readFileSync(defaultAgentConfigPath, 'utf8');
  defaultAgentConfig = JSON.parse(configData);
  console.error('Agent config loaded from:', defaultAgentConfigPath);
} catch (error) {
  console.error('Warning: Could not load default agent config:', error.message);
}

const server = new McpServer({
  name: 'snak',
  version: '1.0.0',
});

server.tool('ping', 'Check if the server is running', async () => {
  return {
    content: [
      {
        type: 'text',
        text: 'pong',
      },
    ],
  };
});

export const RegisterToolInServer = async (allowed_tools: string[]) => {
  const database = {
    database: process.env.POSTGRES_DB as string,
    host: process.env.POSTGRES_HOST as string,
    user: process.env.POSTGRES_USER as string,
    password: process.env.POSTGRES_PASSWORD as string,
    port: parseInt(process.env.POSTGRES_PORT as string),
  };

  const agent = new SnakAgent({
    provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
    accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
    accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
    db_credentials: database,
    agentConfig: defaultAgentConfig as AgentConfig,
    modelSelector: null,
  });
  await agent.init();

  const tools: StarknetTool[] = [];
  await registerTools(agent, allowed_tools, tools);
  for (const tool of tools) {
    if (!tool.schema) {
      server.tool(tool.name, tool.description, async () => {
        const result = await tool.execute(agent, {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result),
            },
          ],
        };
      });
    } else {
      server.tool(
        tool.name,
        tool.description,
        tool.schema.shape,
        // @ts-ignore - Ignoring unused 'extra' parameter for now
        async (params: any, extra: any) => {
          const result = await tool.execute(agent, params);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }
      );
    }
  }
};

async function main() {
  const transport = new StdioServerTransport();
  await RegisterToolInServer(process.argv.slice(2));
  await server.connect(transport);
  console.error('Snak MCP Server running on stdio');
}
main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
