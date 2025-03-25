import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from 'snak-mcps';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../../src/logger.js';

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
   * @description Initializes the MCP_CONTROLLER with configuration from the default config file path
   * @throws {Error} Throws an error if initialization fails
   */
  constructor() {
    const mcp_config_path = path.join(
      process.cwd(),
      '..',
      'config',
      'mcp',
      'mcp.config.json'
    );
    logger.info(`MCP config path: ${mcp_config_path}`);
    this.client = MultiServerMCPClient.fromConfigFile(mcp_config_path);
    logger.info('MCP_CONTROLLER initialized');
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
    } catch (error) {
      throw new Error(`Error closing connections: ${error}`);
    }
  };
}
