import { DynamicStructuredTool, tool } from '@langchain/core/tools';
import { RpcProvider } from 'starknet';
import { AgentConfig } from '../config/agentConfig.js';
import { logger } from '@snakagent/core';
import { metrics } from '@snakagent/core';
import { DatabaseCredentials } from './types/database.js';

/**
 * @interface StarknetAgentInterface
 * @description Interface for the Starknet agent
 * @property {() => { accountPublicKey: string; accountPrivateKey: string; }} getAccountCredentials - Function to get the account credentials
 * @property {() => { signature: string; }} getSignature - Function to get the signature
 * @property {() => RpcProvider} getProvider - Function to get the provider
 * @property {() => AgentConfig} getAgentConfig - Function to get the agent configuration
 * @property {() => PostgresAdaptater[]} getDatabase - Function to get the database
 * @property {(database_name: string) => Promise<void>} connectDatabase - Function to connect to a database
 * @property {(database_name: string) => Promise<PostgresAdaptater | undefined>} createDatabase - Function to create a database
 * @property {(name: string) => PostgresAdaptater | undefined} getDatabaseByName - Function to get a database by name
 */

export interface StarknetAgentInterface {
  getAccountCredentials: () => {
    accountPublicKey: string;
    accountPrivateKey: string;
  };
  getDatabaseCredentials: () => DatabaseCredentials;
  getSignature: () => {
    signature: string;
  };
  getProvider: () => RpcProvider;
  getAgentConfig: () => AgentConfig;
}

/**
 * @interface StarknetTool
 * @description Interface for the Starknet tool
 * @property {string} name - The name of the tool
 * @property {string} plugins - The plugins for the tool
 * @property {string} description - The description of the tool
 * @property {Zod.AnyZodObject} schema - The schema for the tool
 * @property {string} responseFormat - The response format for the tool
 * @property {(agent: StarknetAgentInterface, params: any, plugins_manager?: any) => Promise<unknown>} execute - Function to execute the tool
 */
export interface StarknetTool<P = unknown> {
  name: string;
  plugins: string;
  description: string;
  schema?: Zod.AnyZodObject;
  responseFormat?: string;
  execute: (
    agent: StarknetAgentInterface,
    params: P,
    plugins_manager?: any
  ) => Promise<unknown>;
}

/**
 * @class StarknetToolRegistry
 * @description Class for the Starknet tool registry
 * @property {StarknetTool[]} tools - The tools
 * @method {void} registerTool - Method to register a tool
 * @method {Promise<StarknetTool[]>} createAllowedTools - Method to create allowed tools
 *
 */
export class StarknetToolRegistry {
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
   * @param {StarknetAgentInterface} agent - The Starknet agent
   * @param {string[]} allowed_tools - The allowed tools
   * @returns {Promise<StarknetTool[]>} The allowed tools
   */
  static async createAllowedTools(
    agent: StarknetAgentInterface,
    allowed_tools: string[] = []
  ) {
    // Clear existing tools before registering new ones
    this.clearTools();

    if (!allowed_tools || allowed_tools.length === 0) {
      logger.warn('StarknetToolRegistry: No tools allowed');
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
 * @param {StarknetAgentInterface} agent - The Starknet agent
 * @param {string[]} allowed_tools - The allowed tools
 * @param {StarknetTool[]} tools - The tools
 * @throws {Error} Throws an error if the tools cannot be registered
 */
export const registerTools = async (
  agent: StarknetAgentInterface,
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

          for (const tool of tools_new) {
            metrics.metricsAgentToolUseCount(
              agent.getAgentConfig()?.name ?? 'agent',
              'tools', // TODO: refactored agent interface to allow this
              tool.name
            );
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
 * @param {StarknetAgentInterface} agent - The Starknet agent
 * @param {string[]} allowed_tools - The allowed tools
 * @throws {Error} Throws an error if the allowed tools cannot be created
 */
export const createAllowedTools = async (
  agent: StarknetAgentInterface,
  allowed_tools: string[] = []
): Promise<DynamicStructuredTool<any>[]> => {
  if (!allowed_tools || allowed_tools.length === 0) {
    logger.warn('No tools allowed');
    return [];
  }
  return StarknetToolRegistry.createAllowedTools(agent, allowed_tools);
};

export default StarknetToolRegistry;
