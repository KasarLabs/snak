import { setupTestEnvironment } from '../utils/helper.js';
import { RpcProvider } from 'starknet';
import { SnakAgentInterface, AgentConfig } from '@snakagent/core';
import { SystemMessage } from '@langchain/core/messages';
import { AgentMode } from '@core/src/common/agent.js';

setupTestEnvironment();

export const createMockSnakAgent = (): SnakAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const mockSystemMessage = new SystemMessage('Default system prompt');

  const db_credentials = {
    database: 'test_db',
    host: 'localhost',
    user: 'test_user',
    password: 'test_password',
    port: 5432,
  };
  const agent_config: AgentConfig = {
    name: 'MockAgent',
    prompt: mockSystemMessage,
    interval: 1000,
    chatId: 'mock_chat_id',
    plugins: [],
    memory: false,
    mode: AgentMode.INTERACTIVE,
  };

  return {
    getAccountCredentials: () => ({
      accountPublicKey:
        '0x034ba56f92265f0868c57d3fe72ecab144fc96f97954bbbc4252cef8e8a979ba',
      accountPrivateKey:
        '0x00000000000000000000000000000000b137668388dbe9acdfa3bc734cc2c469',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
    getAgentConfig: () => agent_config,
    getDatabaseCredentials: () => db_credentials,
  };
};

export const createMockInvalidSnakAgent = (): SnakAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const mockSystemMessage = new SystemMessage('Default system prompt');

  const db_credentials = {
    database: 'test_db',
    host: 'localhost',
    user: 'test_user',
    password: 'test_password',
    port: 5432,
  };
  const agent_config: AgentConfig = {
    name: 'MockAgent',
    prompt: mockSystemMessage,
    interval: 1000,
    chatId: 'mock_chat_id',
    plugins: [],
    memory: false,
    mode: AgentMode.INTERACTIVE,
  };

  return {
    getAccountCredentials: () => ({
      accountPublicKey: 'dlksjflkdsjf',
      accountPrivateKey: 'dsfahdskfgdsjkah',
    }),
    getSignature: () => ({
      signature: '',
    }),
    getProvider: () => provider,
    getAgentConfig: () => agent_config,
    getDatabaseCredentials: () => db_credentials,
  };
};
