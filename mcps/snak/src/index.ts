import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RpcProvider } from 'starknet';
import { StarknetAgent, registerTools, StarknetTool } from '@snakagent/agents';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger, ApiKeys, metrics } from '@snakagent/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../../.env') });

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

  const agent = new StarknetAgent({
    provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
    accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
    accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
    signature: 'key',
    db_credentials: database,
    agentMode: 'autonomous',
    agentconfig: undefined,
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
