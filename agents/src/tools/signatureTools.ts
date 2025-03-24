import { tool } from '@langchain/core/tools';
import logger from '../logger.js';

export interface SignatureTool<P = any> {
  name: string;
  categorie?: string;
  description: string;
  schema?: object;
  execute: (params: P) => Promise<unknown>;
}

export class StarknetSignatureToolRegistry {
  private static tools: SignatureTool[] = [];

  static registerTool<P>(tool: SignatureTool<P>): void {
    this.tools.push(tool);
  }

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

export const createSignatureTools = async (allowed_tools: string[]) => {
  return StarknetSignatureToolRegistry.createSignatureTools(allowed_tools);
};

export default StarknetSignatureToolRegistry;
