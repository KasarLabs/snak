import { setupTestEnvironment } from '../utils/helper.js';
import { RpcProvider } from 'starknet';
import { StarknetAgentInterface, JsonConfig } from '@starknet-agent-kit/agents';
import { SystemMessage } from '@langchain/core/messages';

setupTestEnvironment();

export const createMockStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const mockSystemMessage = new SystemMessage('Default system prompt');

  const json_config: JsonConfig = {
    name: 'MockAgent',
    prompt: mockSystemMessage,
    interval: 1000,
    chat_id: 'mock_chat_id',
    plugins: [],
    memory: false,
  };

  return {
    getAccountCredentials: () => ({
      accountPublicKey:
        '0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba',
      accountPrivateKey:
        '0x00000000000000000000000000000000b137668388dbe9acdfa3bc734cc2c469',
    }),
    getModelCredentials: () => ({
      aiModel: '',
      aiProviderApiKey: '',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
    getAgentConfig: () => json_config,
    getDatabase: () => [],
    connectDatabase: async () => {},
    createDatabase: async () => undefined,
    getDatabaseByName: () => undefined,
  };
};

export const createMockInvalidStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const mockSystemMessage = new SystemMessage('Default system prompt');

  const json_config: JsonConfig = {
    name: 'MockAgent',
    prompt: mockSystemMessage,
    interval: 1000,
    chat_id: 'mock_chat_id',
    plugins: [],
    memory: false,
  };

  return {
    getAccountCredentials: () => ({
      accountPublicKey: 'dlksjflkdsjf',
      accountPrivateKey: 'dsfahdskfgdsjkah',
    }),
    getModelCredentials: () => ({
      aiModel: '',
      aiProviderApiKey: '',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
    getAgentConfig: () => json_config,
    getDatabase: () => [],
    connectDatabase: async () => {},
    createDatabase: async () => undefined,
    getDatabaseByName: () => undefined,
  };
};
