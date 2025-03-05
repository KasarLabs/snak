import { tool } from '@langchain/core/tools';
import { RpcProvider } from 'starknet';
import { TransactionMonitor } from '../../common/index.js';
import { ContractInteractor } from '../../common/index.js';
import { TwitterInterface } from '../../common/index.js';
import { JsonConfig } from '../jsonConfig.js';
import { TelegramInterface } from '../../common/index.js';

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
  transactionMonitor: TransactionMonitor;
  contractInteractor: ContractInteractor;
  getTwitterAuthMode: () => 'API' | 'CREDENTIALS' | undefined;
  getAgentConfig: () => JsonConfig;
  getTwitterManager: () => TwitterInterface;
  getTelegramManager: () => TelegramInterface;
}

export interface StarknetTool<P = any> {
  name: string;
  plugins: string;
  description: string;
  schema?: object;
  responseFormat?: string;
  execute: (
    agent: StarknetAgentInterface,
    params: P,
    plugins_manager?: any
  ) => Promise<unknown>;
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

export const initializeTools = (agent: StarknetAgentInterface) => {};

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
        await imported_tool.registerTools(tools);
        return true;
      })
    );
  } catch (error) {
    console.log(error);
  }
};

export const createTools = (agent: StarknetAgentInterface) => {
  return StarknetToolRegistry.createTools(agent);
};
export const createAllowedTools = async (
  agent: StarknetAgentInterface,
  allowed_tools: string[]
) => {
  return StarknetToolRegistry.createAllowedTools(agent, allowed_tools);
};

export default StarknetToolRegistry;
