import { tool } from '@langchain/core/tools';
import { logger } from '@snakagent/core';

/**
 * @interface SignatureTool
 * @description Interface for the signature tool
 * @property {string} name - The name of the tool
 * @property {string} categorie - The categorie of the tool
 * @property {string} description - The description of the tool
 * @property {object} schema - The schema for the tool
 * @property {(params: any) => Promise<unknown>} execute - Function to execute the tool
 */
export interface SignatureTool<P = any> {
  name: string;
  categorie?: string;
  description: string;
  schema?: object;
  execute: (params: P) => Promise<unknown>;
}

/**
 * @class StarknetSignatureToolRegistry
 * @property {SignatureTool[]} tools - Array of signature tools
 * @description Registry for the Starknet signature tools
 */
export class StarknetSignatureToolRegistry {
  private static tools: SignatureTool[] = [];

  static registerTool<P>(tool: SignatureTool<P>): void {
    if (typeof tool.name !== 'string' || tool.name.trim() === '') {
      throw new Error('Tool name is required and cannot be empty');
    }
    if (typeof tool.description !== 'string' || tool.description.trim() === '') {
      throw new Error('Tool description is required and cannot be empty');
    }
    if (typeof tool.execute !== 'function') {
      throw new Error('Tool execute function is required');
    }
    
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
   * @function createSignatureTools
   * @description Creates signature tools
   * @param {string[]} allowed_tools - The allowed tools
   * @returns {Promise<SignatureTool[]>} The signature tools
   */
  static async createSignatureTools(allowed_tools: string[]) {
    // Clear existing tools before registering new ones
    this.clearTools();
    await RegisterSignatureTools(allowed_tools, this.tools);
    return this.tools.map(({ name, description, schema, execute }) =>
      tool(async (params: any) => execute(params), {
        name,
        description,
        ...(schema && { schema }),
      })
    );
  }
}

/**
 * @async
 * @function RegisterSignatureTools
 * @description Registers signature tools
 * @param {string[]} allowed_tools - The allowed tools
 * @param {SignatureTool[]} tools - The signature tools
 * @throws {Error} Throws an error if tools cannot be registered
 */
export const RegisterSignatureTools = async (
  allowed_tools: string[],
  tools: SignatureTool[]
) => {
  try {
    let index = 0;
    await Promise.all(
      allowed_tools.map(async (tool) => {
        index = index + 1;
        const imported_tool = await import(
          `@snakagent/plugin-${tool}/dist/index.js`
        );
        if (typeof imported_tool.registerSignatureTools !== 'function') {
          return false;
        }
        await imported_tool.registerSignatureTools(tools);
        return true;
      })
    );
    
    // Filter out tools with invalid required properties
    const validTools = tools.filter(tool => {
      // Type-safe check for name
      if (typeof tool.name !== 'string' || tool.name.trim() === '') {
        const toolId = typeof tool.name === 'string' ? tool.name : '<unknown-tool>';
        logger.warn(`Skipping tool with empty name: ${toolId}`);
        return false;
      }
      // Type-safe check for description
      if (typeof tool.description !== 'string' || tool.description.trim() === '') {
        const toolId = typeof tool.name === 'string' ? tool.name : '<unknown-tool>';
        logger.warn(`Skipping tool with empty description: ${toolId}`);
        return false;
      }
      // Type-safe check for execute function
      if (typeof tool.execute !== 'function') {
        const toolId = typeof tool.name === 'string' ? tool.name : '<unknown-tool>';
        logger.warn(`Skipping tool with invalid execute function: ${toolId}`);
        return false;
      }
      return true;
    });
    
    // Replace the tools array with only valid tools
    tools.length = 0;
    tools.push(...validTools);
    
    if (tools.length === 0) {
      logger.warn('No valid tools registered');
    }
  } catch (error) {
    logger.error(error);
  }
};

/**
 * @async
 * @function createSignatureTools
 * @description Creates signature tools
 * @param {string[]} allowed_tools - The allowed tools
 * @returns {Promise<SignatureTool[]>} The signature tools
 */
export const createSignatureTools = async (allowed_tools: string[]) => {
  return StarknetSignatureToolRegistry.createSignatureTools(allowed_tools);
};

export default StarknetSignatureToolRegistry;
