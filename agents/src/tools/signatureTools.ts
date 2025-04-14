import { tool } from '@langchain/core/tools';
import { logger } from '@starknet-agent-kit/core';

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
    this.tools.push(tool);
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
          `@starknet-agent-kit/plugin-${tool}/dist/index.js`
        );
        if (typeof imported_tool.registerSignatureTools !== 'function') {
          return false;
        }
        await imported_tool.registerSignatureTools(tools);
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
 * @function createSignatureTools
 * @description Creates signature tools
 * @param {string[]} allowed_tools - The allowed tools
 * @returns {Promise<SignatureTool[]>} The signature tools
 */
export const createSignatureTools = async (allowed_tools: string[]) => {
  return StarknetSignatureToolRegistry.createSignatureTools(allowed_tools);
};

export default StarknetSignatureToolRegistry;
