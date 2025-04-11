import { JsonConfig } from './jsonConfig.js';
import axios from 'axios';
import logger from './logger.js';

export interface MCPConfig {
  name: string;
  bio: string;
  lore: string[];
  objectives: string[];
  knowledge: string[];
  interval: number;
  chat_id: string;
  autonomous: boolean;
  memory: boolean;
  plugins: string[];
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env: {
        [key: string]: string;
      };
    };
  };
}

export interface MCPResponse {
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
  };
  servers: MCP[];
}

export interface MCP {
  id: string;
  name: string;
  description: string;
  attributes: string[];
  environmentVariablesJsonSchema: {
    properties: {
      [key: string]: {
        description: string;
        type: string;
      };
    };
    type: string;
    oneOf: {
      required: string[];
    }[];
  };
  repository: {
    url: string;
  };
  spdxLicense: {
    name: string;
    url: string;
  };
  tools: any[];
  url: string;
}

export class MCPConfigManager {
  private config: JsonConfig;

  constructor(config: JsonConfig) {
    this.config = config;
  }

  async searchMCP(query: string): Promise<MCP[]> {
    try {
      const response = await axios.get(`https://glama.ai/api/mcp/v1/servers?first=5&query=${encodeURIComponent(query)}`);
      return response.data.servers;
    } catch (error) {
      logger.error(`Failed to search MCP servers: ${error}`);
      throw error;
    }
  }

  async addMCP(server: MCP, env: { [key: string]: string }): Promise<void> {
    const serverName = server.name.toLowerCase().replace(/\s+/g, '_');
    
    if (!this.config.mcpServers) {
      this.config.mcpServers = {};
    }

    this.config.mcpServers[serverName] = {
      command: 'npx',
      args: ['-y', `@npm_package_example/${serverName}`],
      env: env
    };

    logger.info(`Added MCP server: ${serverName}`);
  }

  async removeMCP(serverName: string): Promise<void> {
    if (this.config.mcpServers && this.config.mcpServers[serverName]) {
      delete this.config.mcpServers[serverName];
      logger.info(`Removed MCP server: ${serverName}`);
    } else {
      logger.warn(`MCP server not found: ${serverName}`);
    }
  }

  getConfig(): JsonConfig {
    return this.config;
  }
} 