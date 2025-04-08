import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from 'snak-mcps';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../../src/logger.js';
import chalk from 'chalk';

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
  private tools: StructuredTool[] = [];

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
    this.client = new MultiServerMCPClient(mcpServers);
    logger.info('MCP_CONTROLLER initialized');
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
   * @function parseTools
   * @description Parses and collects tools from all connected MCP servers
   * @returns {void}
   * @throws {Error} Throws an error if tools cannot be retrieved
   */
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
      await this.client.initializeConnections();
      this.parseTools();
      logger.info(`MCP connections initialized successfully`);
    } catch (error) {
      throw new Error(`Error initializing connections: ${error}`);
    }
  };

  /**
   * @public
   * @function getTools
   * @description Gets all structured tools available from connected MCP servers
   * @returns {StructuredTool[]} Array of structured tools
   */
  public getTools = (): StructuredTool[] => {
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
