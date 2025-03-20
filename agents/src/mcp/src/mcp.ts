import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from 'snak-mcps';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class MCP_CONTROLLER {
  private client: MultiServerMCPClient;
  private tools: StructuredTool[] = [];

  constructor() {
    const mcp_config_path = path.join(
      process.cwd(),
      '..',
      'config',
      'mcp',
      'mcp.config.json'
    );
    console.log(`MCP config path: ${mcp_config_path}`);
    this.client = MultiServerMCPClient.fromConfigFile(mcp_config_path);
    console.log('MCP_CONTROLLER initialized');
  }
  private parseTools = () => {
    try {
      const raw_tools = this.client.getTools();
      if (!raw_tools) {
        throw new Error('No tools found');
      }
      const tools_array = Array.from(raw_tools.values());
      for (const tools of tools_array) {
        for (const tool of tools) {
          this.tools.push(tool);
        }
      }
    } catch (error) {
      throw new Error(`Error getting tools: ${error}`);
    }
  };

  public initializeConnections = async () => {
    try {
      await this.client.initializeConnections();
      this.parseTools();
    } catch (error) {
      throw new Error(`Error initializing connections: ${error}`);
    }
  };

  public getTools = (): StructuredTool[] => {
    return this.tools;
  };

  public close = async () => {
    try {
      await this.client.close();
    } catch (error) {
      throw new Error(`Error closing connections: ${error}`);
    }
  };
}
