import { tool } from '@langchain/core/tools';
import { RpcProvider } from 'starknet';
import { JsonConfig } from '../jsonConfig.js';
import { PostgresAdaptater } from '../databases/postgresql/src/database.js';
import logger from '../logger.js';

/**
 * @interface StarknetAgentInterface
 * @description Interface for the Starknet agent
 * @property {() => { accountPublicKey: string; accountPrivateKey: string; }} getAccountCredentials - Function to get the account credentials
 * @property {() => { aiModel: string; aiProviderApiKey: string; }} getModelCredentials - Function to get the model credentials
 * @property {() => { signature: string; }} getSignature - Function to get the signature
 * @property {() => RpcProvider} getProvider - Function to get the provider
 * @property {() => JsonConfig} getAgentConfig - Function to get the agent configuration
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
  getModelCredentials: () => {
    aiModel: string;
    aiProviderApiKey: string;
  };
  getSignature: () => {
    signature: string;
  };
  getProvider: () => RpcProvider;
  getAgentConfig: () => JsonConfig | undefined;
  getDatabase: () => PostgresAdaptater[];
  connectDatabase: (database_name: string) => Promise<void>;
  createDatabase: (
    database_name: string
  ) => Promise<PostgresAdaptater | undefined>;
  getDatabaseByName: (name: string) => PostgresAdaptater | undefined;
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
export interface StarknetTool<P = any> {
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
   * @async
   * @function createAllowedTools
   * @description Creates allowed tools
   * @param {StarknetAgentInterface} agent - The Starknet agent
   * @param {string[]} allowed_tools - The allowed tools
   * @returns {Promise<StarknetTool[]>} The allowed tools
   */
  static async createAllowedTools(
    agent: StarknetAgentInterface,
    allowed_tools: string[]
  ) {
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
 * @returns {Promise<void>}
 * @throws {Error} Throws an error if the tools cannot be registered
 */
export const registerTools = async (
  agent: StarknetAgentInterface,
  allowed_tools: string[],
  tools: StarknetTool[]
) => {
  try {
    let index = 0;
    await Promise.all(
      allowed_tools.map(async (tool) => {
        index = index + 1;

        const imported_tool = await import(
          `@starknet-agent-kit/plugin-${tool}/dist/index.js`
        );
        if (typeof imported_tool.registerTools !== 'function') {
          return false;
        }
        await imported_tool.registerTools(tools, agent);
        return true;
      })
    );
    if (tools.length === 0) {
      logger.warn('No tools registered');
    }
  } catch (error) {
    logger.error(error);
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
  allowed_tools: string[]
) => {
  if (allowed_tools.length === 0) {
    logger.warn('No tools allowed');
  }
  return StarknetToolRegistry.createAllowedTools(agent, allowed_tools);
};

export default StarknetToolRegistry;
