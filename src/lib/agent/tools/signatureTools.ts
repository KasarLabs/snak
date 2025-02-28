import { tool } from '@langchain/core/tools';
import { registerSignatureToolsAccount } from '../plugins/core/account/tools/tools_signature';
import { registerSignatureToolsToken } from '../plugins/core/token/tools/tools_signature';
import { registerSignatureToolsERC721 } from '../plugins/erc721/tools/signatureTools';

interface SignatureTool<P = any> {
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

  static createSignatureTools() {
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

export const RegisterSignatureTools = () => {
  registerSignatureToolsToken();
  registerSignatureToolsAccount();
  registerSignatureToolsERC721();
};

RegisterSignatureTools();

export const createSignatureTools = () => {
  return StarknetSignatureToolRegistry.createSignatureTools();
};

export default StarknetSignatureToolRegistry;
