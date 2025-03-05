import { tool } from '@langchain/core/tools';
export interface SignatureTool<P = any> {
  name: string;
  categorie?: string;
  description: string;
  schema?: object;
  execute: (params: P) => Promise<unknown>;
}

export class StarknetSignatureToolRegistry {
  private static tools: SignatureTool[] = [];

  static RegisterSignatureTools<P>(tool: SignatureTool<P>): void {
    this.tools.push(tool);
  }

  static async createSignatureTools(allowed_signature_tools: string[]) {
    await RegisterSignatureTools(allowed_signature_tools, this.tools);
    return this.tools.map(({ name, description, schema, execute }) => {
      const toolInstance = tool(async (params: any) => execute(params), {
        name,
        description,
        ...(schema && { schema }),
      });
      return toolInstance;
    });
  }
}

export const RegisterSignatureTools = async (
  allowed_signature_tools: string[],
  tools: SignatureTool[]
) => {
  try {
    await Promise.all(
      allowed_signature_tools.map(async (tool) => {
        try {
          const possiblePaths = [
            `@starknet-agent-kit/plugin-${tool}/index.js`,
            `@starknet-agent-kit/plugin-${tool}/dist/index.js`,
            `../../plugins/${tool}/dist/index.js`,
            `../../../plugins/${tool}/dist/index.js`,
          ];

          let imported_tool = null;
          for (const path of possiblePaths) {
            try {
              imported_tool = await import(path);
              break;
            } catch {}
          }

          if (!imported_tool) {
            console.warn(`Could not import plugin ${tool} from any known path`);
            return false;
          }

          if (typeof imported_tool.registerSignatureTools !== 'function') {
            return false;
          }

          imported_tool.registerSignatureTools(tools);
          return true;
        } catch (error) {
          console.warn(`Error processing plugin ${tool}: ${error.message}`);
          return false;
        }
      })
    );
  } catch (error) {
    console.error('Error in RegisterSignatureTools:', error);
  }
};

export const createSignatureTools = async (
  allowed_signature_tools: string[]
) => {
  return StarknetSignatureToolRegistry.createSignatureTools(
    allowed_signature_tools
  );
};

export default StarknetSignatureToolRegistry;
