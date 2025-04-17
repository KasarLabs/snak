import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { RpcProvider } from 'starknet';
import {
  StarknetAgent,
  registerTools,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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

// Placeholder for ModelLevelConfig if not imported
interface ModelLevelConfig {
  provider: string;
  model_name: string;
  description?: string;
}

// Placeholder for ModelsConfig if not imported
interface ModelsConfig {
  models: {
    fast: ModelLevelConfig;
    smart: ModelLevelConfig;
    cheap: ModelLevelConfig;
    [key: string]: ModelLevelConfig;
  };
}

export const RegisterToolInServer = async (allowed_tools: string[]) => {
  // Define a minimal valid ModelsConfig
  const minimalModelsConfig: ModelsConfig = {
    models: {
      fast: { provider: 'placeholder', model_name: 'placeholder-fast' },
      smart: { provider: 'placeholder', model_name: 'placeholder-smart' },
      cheap: { provider: 'placeholder', model_name: 'placeholder-cheap' },
    },
  };

  const agent = new StarknetAgent({
    provider: new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL }),
    accountPrivateKey: process.env.STARKNET_PRIVATE_KEY as string,
    accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS as string,
    aiProviderApiKey: process.env.AI_PROVIDER_API_KEY as string,
    signature: 'key',
    agentMode: 'agent',
    agentconfig: undefined,
    modelsConfig: minimalModelsConfig,
  });
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
