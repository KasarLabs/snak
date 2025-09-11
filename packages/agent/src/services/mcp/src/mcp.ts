import { StructuredTool } from '@langchain/core/tools';
import { MultiServerMCPClient } from 'snak-mcps';
import { AgentConfig, logger } from '@snakagent/core';

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
   * @static
   * @function fromAgentConfig
   * @description Creates an MCP_CONTROLLER instance from agent config
   * @param {any} agentConfig - The agent configuration
   * @returns {MCP_CONTROLLER} A new MCP_CONTROLLER instance
   */
  public static fromAgentConfig(agentConfig: AgentConfig): MCP_CONTROLLER {
    if (
      !agentConfig ||
      !agentConfig.mcpServers ||
      Object.keys(agentConfig.mcpServers).length === 0
    ) {
      throw new Error('Agent configuration must include mcpServers');
    }

    return new MCP_CONTROLLER(agentConfig.mcpServers);
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

  /**
   * @public
   * @async
   * @function shutdown
   * @description Shuts down the MCP and all its adapters.
   * @returns {Promise<void>}
   */
  public async shutdown() {
    logger.info('MCP shutting down...');
    await this.close();
    logger.info('MCP shutdown complete.');
  }
}
