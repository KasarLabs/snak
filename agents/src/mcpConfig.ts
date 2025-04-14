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

// Smithery API interfaces
export interface SmitheryServer {
  qualifiedName: string;
  displayName: string;
  description: string;
  homepage: string;
  useCount: number;
  isDeployed: boolean;
  createdAt: string;
}

export interface SmitherySearchResponse {
  servers: SmitheryServer[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
}

export interface SmitheryServerDetails {
  qualifiedName: string;
  displayName: string;
  remote: boolean;
  connections: {
    type: string;
    deploymentUrl: string;
    configSchema: {
      type: string;
      required: string[];
      properties: {
        [key: string]: {
          type: string;
          description: string;
        };
      };
    };
  }[];
}

// Callback type for config change events
export type OnConfigChangeCallback = (config: JsonConfig) => Promise<void>;

export class MCPConfigManager {
  private config: JsonConfig;
  private configPath: string;
  private configWatcher: fs.FSWatcher | null = null;
  private onConfigChangeCallbacks: OnConfigChangeCallback[] = [];
  private smitheryApiKey: string = '4fc37f77-2258-46ea-b1e7-924aff06bf5c';

  constructor(config: JsonConfig, configPath: string) {
    this.config = config;
    this.configPath = configPath;
    this.setupConfigWatcher();
  }

  /**
   * Register a callback that will be called when the configuration changes
   * @param callback Function to call when configuration changes
   */
  onConfigChange(callback: OnConfigChangeCallback): void {
    this.onConfigChangeCallbacks.push(callback);
    logger.info('Registered new MCP configuration change callback');
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
   * Reloads the configuration from the file and notifies listeners
   */
  async reloadConfig(): Promise<void> {
    try {
      const fileContent = await fs.promises.readFile(this.configPath, 'utf8');
      const newConfig = JSON.parse(fileContent);
      this.config = newConfig;
      logger.info(`MCP configuration reloaded successfully`);

      // Notify all registered callbacks about configuration change
      if (this.onConfigChangeCallbacks.length > 0) {
        logger.info(
          `Notifying ${this.onConfigChangeCallbacks.length} listeners about MCP config change`
        );

        for (const callback of this.onConfigChangeCallbacks) {
          try {
            await callback(this.config);
          } catch (error) {
            logger.error(
              `Error in MCP configuration change callback: ${error}`
            );
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to reload configuration: ${error}`);
    }
  }

  async searchMCP(query: string): Promise<MCP[]> {
    try {
      // Use Smithery API instead of MCPHub
      const response = await axios.get(
        `https://registry.smithery.ai/servers?q=${encodeURIComponent(query)}&page=1&pageSize=5`,
        {
          headers: {
            Authorization: `Bearer ${this.smitheryApiKey}`,
          },
        }
      );

      const searchResponse = response.data as SmitherySearchResponse;

      if (!searchResponse.servers || searchResponse.servers.length === 0) {
        return [];
      }

      // Transform response format to match the expected MCP interface
      return searchResponse.servers.map((server: SmitheryServer) => ({
        name: server.displayName,
        description: server.description,
        title: server.displayName,
        similarity: server.useCount, // Using useCount as a proxy for similarity
        url: server.homepage,
        // Store qualifiedName for later use when adding the server
        id: server.qualifiedName,
      }));
    } catch (error) {
      logger.error(`Failed to search Smithery servers: ${error}`);
      throw error;
    }
  }

  async getServerDetails(
    qualifiedName: string
  ): Promise<SmitheryServerDetails> {
    try {
      const response = await axios.get(
        `https://registry.smithery.ai/servers/${qualifiedName}`,
        {
          headers: {
            Authorization: `Bearer ${this.smitheryApiKey}`,
          },
        }
      );

      return response.data as SmitheryServerDetails;
    } catch (error) {
      logger.error(`Failed to get Smithery server details: ${error}`);
      throw error;
    }
  }

  async addMCP(server: MCP, env: { [key: string]: string }): Promise<void> {
    try {
      // Use the server name from the server object, default to a slug of the title if not available
      const serverName = (server.name || server.title || '')
        .toLowerCase()
        .replace(/\s+/g, '-');

      if (!this.config.mcpServers) {
        this.config.mcpServers = {};
      }

      let qualifiedName = server.id;

      // If we have a qualifiedName (from Smithery search), use it directly
      if (qualifiedName) {
        // Convert config to JSON string
        const configJson = JSON.stringify(env);

        this.config.mcpServers[serverName] = {
          command: 'npx',
          args: [
            '-y',
            '@smithery/cli@latest',
            'run',
            qualifiedName,
            '--config',
            configJson,
          ],
          env: {},
        };
      } else {
        // Fallback to old MCP behavior for backward compatibility
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
          env: env,
        };
      }

      // Save the updated configuration to file
      await this.saveConfig();

      logger.info(`Added server: ${serverName}`);
    } catch (error) {
      logger.error(`Failed to add server: ${error}`);
      throw error;
    }
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

      // After saving, manually trigger configuration reload to notify listeners
      await this.reloadConfig();
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
    // Clear all callbacks
    this.onConfigChangeCallbacks = [];
  }
}
