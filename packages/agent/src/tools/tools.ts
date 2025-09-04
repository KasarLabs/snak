import {
  DynamicStructuredTool,
  StructuredTool,
  Tool,
  tool,
} from '@langchain/core/tools';
import { logger, AgentConfig } from '@snakagent/core';
import { metrics } from '@snakagent/metrics';
import { AnyZodObject } from 'zod';
import { MCP_CONTROLLER } from '@services/mcp/src/mcp.js';
import { SnakAgentInterface, StarknetTool } from '../types/tools.types.js';

/**
 * Initializes the list of tools for the agent based on signature type and configuration
 * @param snakAgent - The agent interface instance
 * @param agentConfig - Configuration object containing plugins and MCP servers
 * @returns Promise resolving to array of tools
 */
export async function initializeToolsList(
  snakAgent: SnakAgentInterface,
  agentConfig: AgentConfig
): Promise<(StructuredTool | Tool | DynamicStructuredTool<AnyZodObject>)[]> {
  let toolsList: (Tool | DynamicStructuredTool<any> | StructuredTool)[] = [];
  const allowedTools = await createAllowedTools(snakAgent, agentConfig.plugins);
  toolsList = [...allowedTools];
  if (
    agentConfig.mcpServers &&
    Object.keys(agentConfig.mcpServers).length > 0
  ) {
    try {
      const mcp = MCP_CONTROLLER.fromAgentConfig(agentConfig);
      await mcp.initializeConnections();

      const mcpTools = mcp.getTools();
      logger.info(`Added ${mcpTools.length} MCP tools to the agent`);
      toolsList = [...toolsList, ...mcpTools];
    } catch (error) {
      logger.error(`Failed to initialize MCP tools: ${error}`);
    }
  }
  return toolsList;
}

/**
 * @class SnakToolRegistry
 * @description Class for the Starknet tool registry
 * @property {StarknetTool[]} tools - The tools
 * @method {void} registerTool - Method to register a tool
 * @method {Promise<StarknetTool[]>} createAllowedTools - Method to create allowed tools
 *
 */
export class SnakToolRegistry {
  private static tools: StarknetTool[] = [];

  static registerTool<P>(tool: StarknetTool<P>): void {
    this.tools.push(tool);
  }

  /**
   * @static
   * @function clearTools
   * @description Clears all registered tools
   */
  static clearTools(): void {
    this.tools = [];
  }

  /**
   * @static
   * @async
   * @function createAllowedTools
   * @description Creates allowed tools
   * @param {SnakAgentInterface} agent - The Starknet agent
   * @param {string[]} allowed_tools - The allowed tools
   * @returns {Promise<StarknetTool[]>} The allowed tools
   */
  static async createAllowedTools(
    agent: SnakAgentInterface,
    allowed_tools: string[] = []
  ) {
    // Clear existing tools before registering new ones
    this.clearTools();

    if (!allowed_tools || allowed_tools.length === 0) {
      logger.warn('SnakToolRegistry: No tools allowed');
      return [];
    }

    await registerTools(agent, allowed_tools, this.tools);
    return this.tools.map(({ name, description, schema, execute }) =>
      tool(async (params: any) => execute(agent, params), {
        name,
        description,
        ...(schema && { schema }),
      })
    );
  }
}

/**
 * @async
 * @function registerTools
 * @description Registers tools
 * @param {SnakAgentInterface} agent - The Starknet agent
 * @param {string[]} allowed_tools - The allowed tools
 * @param {StarknetTool[]} tools - The tools
 * @throws {Error} Throws an error if the tools cannot be registered
 */
export const registerTools = async (
  agent: SnakAgentInterface,
  allowed_tools: string[] = [],
  tools: StarknetTool[]
): Promise<void> => {
  try {
    if (!allowed_tools || allowed_tools.length === 0) {
      logger.warn('registerTools: No tools to register');
      return;
    }

    let index = 0;
    await Promise.all(
      allowed_tools.map(async (tool) => {
        if (!tool) {
          logger.warn(
            `registerTools: Skipping undefined tool at index ${index}`
          );
          return false;
        }

        index = index + 1;

        try {
          const imported_tool = await import(
            `@snakagent/plugin-${tool}/dist/index.js`
          );
          if (typeof imported_tool.registerTools !== 'function') {
            logger.warn(
              `Plugin ${tool} does not export a registerTools function`
            );
            return false;
          }
          const tools_new = new Array<StarknetTool>();
          await imported_tool.registerTools(tools_new, agent);
          const agentId = agent.getAgentConfig().id;
          const agentMode = agent.getAgentConfig().mode;

          if (!agentId || !agentMode) {
            logger.warn(
              `Agent ID or mode is not defined for agent: ${JSON.stringify(
                agent.getAgentConfig()
              )}`
            );
            return false;
          }

          for (const tool of tools_new) {
            metrics.agentToolUseCount(agentId.toString(), agentMode, tool.name);
          }

          tools.push(...tools_new);
          return true;
        } catch (error) {
          logger.error(`Error loading plugin ${tool}: ${error}`);
          return false;
        }
      })
    );
    if (tools.length === 0) {
      logger.warn('No tools registered');
    }
  } catch (error) {
    logger.error(`Error registering tools: ${error}`);
  }
};

/**
 * @async
 * @function createAllowedTools
 * @description Creates allowed tools
 * @param {SnakAgentInterface} agent - The Starknet agent
 * @param {string[]} allowed_tools - The allowed tools
 * @throws {Error} Throws an error if the allowed tools cannot be created
 */
export const createAllowedTools = async (
  agent: SnakAgentInterface,
  allowed_tools: string[] = []
): Promise<DynamicStructuredTool<any>[]> => {
  if (!allowed_tools || allowed_tools.length === 0) {
    logger.warn('No tools allowed');
    return [];
  }
  return SnakToolRegistry.createAllowedTools(agent, allowed_tools);
};

export default SnakToolRegistry;
