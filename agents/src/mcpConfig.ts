import { JsonConfig } from './jsonConfig.js';
import axios from 'axios';
import logger from './logger.js';
import * as fs from 'fs';
import path from 'path';
import { watchFile } from 'fs';

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
  servers: MCP[];
}

export interface MCP {
  id?: string;
  name: string;
  description: string;
  title?: string;
  similarity?: number;
  github_url?: string;
  repository?: {
    url: string;
  };
  attributes?: string[];
  environmentVariablesJsonSchema?: {
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
  spdxLicense?: {
    name: string;
    url: string;
  };
  tools?: any[];
  url?: string;
}

export class MCPConfigManager {
  private config: JsonConfig;
  private configPath: string;
  private configWatcher: fs.FSWatcher | null = null;

  constructor(config: JsonConfig, configPath: string) {
    this.config = config;
    this.configPath = configPath;
    this.setupConfigWatcher();
  }

  /**
   * Sets up a file watcher to reload the config when it changes
   */
  private setupConfigWatcher(): void {
    if (this.configWatcher) {
      this.configWatcher.close();
    }

    try {
      this.configWatcher = fs.watch(this.configPath, async (eventType) => {
        if (eventType === 'change') {
          logger.info(`MCP configuration file changed, reloading...`);
          await this.reloadConfig();
        }
      });
      logger.info(`MCP configuration watcher setup for ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to setup config watcher: ${error}`);
    }
  }

  /**
   * Reloads the configuration from the file
   */
  async reloadConfig(): Promise<void> {
    try {
      const fileContent = await fs.promises.readFile(this.configPath, 'utf8');
      const newConfig = JSON.parse(fileContent);
      this.config = newConfig;
      logger.info(`MCP configuration reloaded successfully`);
    } catch (error) {
      logger.error(`Failed to reload configuration: ${error}`);
    }
  }

  async searchMCP(query: string): Promise<MCP[]> {
    try {
      const response = await axios.get(`https://registry.mcphub.io/recommend?description=${encodeURIComponent(query)}`);
      
      if (!response.data || response.data.length === 0) {
        return [];
      }
      
      // Transform response format to match the expected MCP interface
      return response.data.map((server: any) => ({
        name: server.title,
        description: server.description,
        title: server.title,
        similarity: server.similarity,
        repository: {
          url: server.github_url
        },
        github_url: server.github_url
      }));
    } catch (error) {
      logger.error(`Failed to search MCP servers: ${error}`);
      throw error;
    }
  }

  async addMCP(server: MCP, env: { [key: string]: string }): Promise<void> {
    // Use title if name is not available (for MCP Compass responses)
    const serverName = (server.name || server.title || '').toLowerCase().replace(/\s+/g, '_');
    
    if (!this.config.mcpServers) {
      this.config.mcpServers = {};
    }

    // Get the package name from GitHub URL if available
    let packageName = `@npm_package_example/${serverName}`;
    if (server.github_url) {
      const urlParts = server.github_url.split('/');
      if (urlParts.length >= 2) {
        const repoOwner = urlParts[urlParts.length - 2];
        const repoName = urlParts[urlParts.length - 1];
        if (repoOwner && repoName) {
          packageName = `@${repoOwner}/${repoName}`;
        }
      }
    }

    this.config.mcpServers[serverName] = {
      command: 'npx',
      args: ['@mcpm/cli', 'install', packageName],
      env: env
    };

    // Save the updated configuration to file
    await this.saveConfig();

    logger.info(`Added MCP server: ${serverName}`);
  }

  async removeMCP(serverName: string): Promise<void> {
    if (this.config.mcpServers && this.config.mcpServers[serverName]) {
      delete this.config.mcpServers[serverName];
      // Save the updated configuration to file
      await this.saveConfig();
      logger.info(`Removed MCP server: ${serverName}`);
    } else {
      logger.warn(`MCP server not found: ${serverName}`);
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2)
      );
      logger.info(`Configuration saved to ${this.configPath}`);
    } catch (error) {
      logger.error(`Failed to save configuration: ${error}`);
      throw error;
    }
  }

  getConfig(): JsonConfig {
    return this.config;
  }

  /**
   * Cleans up resources when the manager is no longer needed
   */
  cleanup(): void {
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
      logger.info('MCP configuration watcher closed');
    }
  }
} 