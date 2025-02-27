import { tool } from '@langchain/core/tools';
import { RpcProvider } from 'starknet';
import { AccountManager } from '../plugins/core/account/utils/AccountManager';
import { TransactionMonitor } from '../plugins/core/transaction/utils/TransactionMonitor';
import { ContractInteractor } from '../plugins/core/contract/utils/ContractInteractor';
import { TwitterInterface } from '../plugins/twitter/interfaces';
import { JsonConfig } from '../jsonConfig';
import { registerTwitterTools } from '../plugins/twitter/tools';
import { registerUnraggableTools } from '../plugins/unruggable/tools';
import { registerTransactionTools } from '../plugins/core/transaction/tools';
import { registerRPCTools } from '../plugins/core/rpc/tools';
import { registerERC20Tools } from '../plugins/erc20/tools/tools';
import { registerAvnuTools } from '../plugins/avnu/tools';
import { registerAccountTools } from '../plugins/core/account/tools/index';
import { registerFibrousTools } from '../plugins/fibrous/tools';
import { register } from 'module';
import { registerTelegramTools } from '../plugins/telegram/tools';
import { TelegramInterface } from '../plugins/telegram/interfaces';

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
  accountManager: AccountManager;
  transactionMonitor: TransactionMonitor;
  contractInteractor: ContractInteractor;
  getTwitterAuthMode: () => 'API' | 'CREDENTIALS' | undefined;
  getAgentConfig: () => JsonConfig | undefined;
  getTwitterManager: () => TwitterInterface;
  getTelegramManager: () => TelegramInterface;
}

export interface StarknetTool<P = any> {
  name: string;
  plugins: string;
  description: string;
  schema?: object;
  responseFormat?: string;
  execute: (agent: StarknetAgentInterface, params: P) => Promise<unknown>;
}

export class StarknetToolRegistry {
  private static tools: StarknetTool[] = [];

  static registerTool<P>(tool: StarknetTool<P>): void {
    this.tools.push(tool);
  }

  static createTools(agent: StarknetAgentInterface) {
    return this.tools.map(({ name, description, schema, execute }) =>
      tool(async (params: any) => execute(agent, params), {
        name,
        description,
        ...(schema && { schema }),
      })
    );
  }

  static createAllowedTools(
    agent: StarknetAgentInterface,
    allowed_tools: string[]
  ) {
    const filteredTools = this.tools.filter((tool) =>
      allowed_tools.includes(tool.name)
    );
    let tools = this.tools.filter((tool) =>
      allowed_tools.includes(tool.plugins)
    );
    return tools.map(({ name, description, schema, execute }) =>
      tool(async (params: any) => execute(agent, params), {
        name,
        description,
        ...(schema && { schema }),
      })
    );
  }
}

export const registerTools = () => {
  registerAccountTools();

  registerAvnuTools();

  registerERC20Tools();

  registerRPCTools();

  registerTransactionTools();

  registerUnraggableTools();

  registerTwitterTools();

  registerFibrousTools();

  registerTelegramTools();
};

registerTools();
// Initialize tools

export const createTools = (agent: StarknetAgentInterface) => {
  return StarknetToolRegistry.createTools(agent);
};

export const createAllowedTools = (
  agent: StarknetAgentInterface,
  allowed_tools: string[]
) => {
  return StarknetToolRegistry.createAllowedTools(agent, allowed_tools);
};

export default StarknetToolRegistry;
