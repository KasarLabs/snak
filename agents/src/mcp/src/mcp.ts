import { StructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../../src/logger.js';
import chalk from 'chalk';
import { raw } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @class MCP_CONTROLLER
 * @description Controller for managing MCP (Model context protocol) Client and its tools
 * @property {MultiServerMCPClient} client - Client instance for managing multiple MCP server connections
 * @property {StructuredTool[]} tools - Array of structured tools available from the MCP servers
 */
export class MCP_CONTROLLER {
  private client: MultiServerMCPClient;
  private tools: StructuredToolInterface<any>[] = [];
  private currentConfig: Record<string, any>;
  // Add an event handler system for tool updates
  private toolUpdateHandlers: ((
    tools: StructuredToolInterface<any>[]
  ) => void)[] = [];

  /**
   * @constructor
   * @description Initializes the MCP_CONTROLLER with configuration
   * @param {Record<string, any>} mcpServers - MCP servers configuration from agent config
   * @throws {Error} Throws an error if initialization fails
   */
  constructor(mcpServers: Record<string, any>) {
    if (!mcpServers || Object.keys(mcpServers).length === 0) {
      throw new Error('MCP servers configuration is required');
    }
    logger.info('Initializing MCP_CONTROLLER with provided servers config');
    this.currentConfig = { ...mcpServers };
    console.log(JSON.stringify(this.currentConfig));
    this.client = new MultiServerMCPClient(mcpServers);
  }
      

  /**
   * @public
   * @function onToolsUpdate
   * @description Register a callback that will be called when the tools list changes
   * @param {function} handler - Function to call when tools are updated
   * @returns {void}
   */
  public onToolsUpdate(handler: (tools: StructuredTool[]) => void): void {
    this.toolUpdateHandlers.push(handler);
    logger.info('Registered new MCP tools update handler');
  }

  /**
   * @private
   * @function notifyToolsUpdate
   * @description Notify all registered handlers that tools have been updated
   * @returns {void}
   */
  private notifyToolsUpdate(): void {
    if (this.toolUpdateHandlers.length > 0) {
      logger.info(
        `Notifying ${this.toolUpdateHandlers.length} listeners about MCP tools update`
      );

      for (const handler of this.toolUpdateHandlers) {
        try {
          handler(this.tools);
        } catch (error) {
          logger.error(`Error in MCP tools update handler: ${error}`);
        }
      }
    }
  }

  /**
   * @private
   * @function silenceConsoleLogs
   * @description Temporarily silences console logs for MCP servers
   */
  private silenceConsoleLogs() {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    // Override console methods
    console.log = (...args) => {
      // Only filter MCP-related logs
      const message = args.join(' ');
      if (!message.includes('MCP') && !message.includes('server')) {
        originalConsoleLog(...args);
      }
    };

    console.error = (...args) => {
      // Only filter MCP-related logs
      const message = args.join(' ');
      if (!message.includes('MCP') && !message.includes('server')) {
        originalConsoleError(...args);
      }
    };
  }

  /**
   * @static
   * @function fromJsonConfig
   * @description Creates an MCP_CONTROLLER instance from agent config
   * @param {any} jsonConfig - The agent configuration
   * @returns {MCP_CONTROLLER} A new MCP_CONTROLLER instance
   */
  public static fromJsonConfig(jsonConfig: any): MCP_CONTROLLER {
    if (
      !jsonConfig ||
      !jsonConfig.mcpServers ||
      Object.keys(jsonConfig.mcpServers).length === 0
    ) {
      throw new Error('Agent configuration must include mcpServers');
    }

    return new MCP_CONTROLLER(jsonConfig.mcpServers);
  }

  /**
   * @private
   * @async
   * @function parseTools
   * @description Parses and collects tools from all connected MCP servers
   * @returns {void}
   * @throws {Error} Throws an error if tools cannot be retrieved
   */
  private parseTools = async () => {
    try {
      // Clear existing tools first
      this.tools = [];
      const raw_tools = await this.client.getTools();
      if (!raw_tools) {
        throw new Error('No tools found');
      }
      for (const tools of raw_tools) {
        this.tools.push(tools);
      }

      // Log tools to help with debugging
      logger.info(`Loaded ${this.tools.length} tools from MCP servers`);
      this.tools.forEach((tool) => {
        logger.info(`MCP tool available: ${tool.name}`);
      });
      // Notify all handlers about the updated tools
      this.notifyToolsUpdate();
    } catch (error) {
      throw new Error(`Error getting tools: ${error}`);
    }
  };

  /**
   * @public
   * @async
   * @function initializeConnections
   * @description Initializes connections to all MCP servers defined in the config and collects their tools
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if connections cannot be initialized
   */
  public initializeConnections = async () => {
    try {
      await this.parseTools();
      console.log(this.tools);
      logger.info(`MCP connections initialized successfully`);
    } catch (error) {
      throw new Error(`Error initializing connections: ${error}`);
    }
  };

  /**
   * @public
   * @async
   * @function reloadConnections
   * @description Reloads all MCP connections without changing configuration
   * This is useful when you want to force a refresh of connections and tools
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if the reload fails
   */
  public reloadConnections = async (): Promise<void> => {
    try {
      logger.info('Force reloading MCP connections...');

      // Close existing connections
      await this.close();

      // Recreate client with same configuration
      this.client = new MultiServerMCPClient(this.currentConfig);

      // Reinitialize connections
      await this.initializeConnections();

      logger.info('MCP connections reloaded successfully');
      return;
    } catch (error) {
      logger.error(`Error reloading MCP connections: ${error}`);
      throw error;
    }
  };

  /**
   * @public
   * @async
   * @function updateConfiguration
   * @description Updates the MCP servers configuration, closes existing connections and reinitializes
   * @param {Record<string, any>} mcpServers - New MCP servers configuration
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if the update fails
   */
  public updateConfiguration = async (
    mcpServers: Record<string, any>
  ): Promise<void> => {
    if (!mcpServers || Object.keys(mcpServers).length === 0) {
      throw new Error('MCP servers configuration is required for update');
    }

    try {
      // Check if configuration has actually changed
      const configChanged =
        JSON.stringify(this.currentConfig) !== JSON.stringify(mcpServers);

      if (!configChanged) {
        logger.info('MCP configuration unchanged, skipping reconnection');
        return;
      }

      logger.info('Updating MCP configuration and restarting connections');

      // Close existing connections
      await this.close();

      // Update configuration
      this.currentConfig = { ...mcpServers };
      this.client = new MultiServerMCPClient(mcpServers);

      // Reinitialize connections
      await this.initializeConnections();

      logger.info(
        'MCP configuration updated and connections reinitialized successfully'
      );
    } catch (error) {
      throw new Error(`Error updating MCP configuration: ${error}`);
    }
  };

  /**
   * @public
   * @function getTools
   * @description Gets all structured tools available from connected MCP servers
   * @returns {StructuredTool[]} Array of structured tools
   */
  public getTools = (): StructuredToolInterface<any>[] => {
    return this.tools;
  };

  /**
   * @public
   * @async
   * @function close
   * @description Closes all connections to MCP servers
   * @returns {Promise<void>}
   * @throws {Error} Throws an error if connections cannot be closed properly
   */
  public close = async () => {
    try {
      await this.client.close();
      logger.info('MCP connections closed');
    } catch (error) {
      throw new Error(`Error closing connections: ${error}`);
    }
  };
}
