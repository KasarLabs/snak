import { setupTestEnvironment } from '../utils/helper.js';
import { RpcProvider } from 'starknet';
import { StarknetAgentInterface, JsonConfig } from '@hijox/core';
import { SystemMessage } from '@langchain/core/messages';
import { Postgres } from '@hijox/database/queries';

setupTestEnvironment();

export const createMockStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const mockSystemMessage = new SystemMessage('Default system prompt');
  const database = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  };
  const json_config: JsonConfig = {
    name: 'MockAgent',
    prompt: mockSystemMessage,
    interval: 1000,
    chat_id: 'mock_chat_id',
    plugins: [],
    memory: false,
    mode: {
      interactive: true,
      autonomous: false,
      recursionLimit: 15,
    },
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
    getAgentConfig: () => json_config,
    getDatabaseCredentials: () => database,
    getDatabase: () => new Map<string, Postgres>(),
    setDatabase: (databases: Map<string, Postgres>) => {
      console.log('Database set:', databases);
    },
  };
};

export const createMockInvalidStarknetAgent = (): StarknetAgentInterface => {
  const provider = new RpcProvider({ nodeUrl: 'http://127.0.0.1:5050' });
  const mockSystemMessage = new SystemMessage('Default system prompt');

  const database = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  };
  const json_config: JsonConfig = {
    name: 'MockAgent',
    prompt: mockSystemMessage,
    interval: 1000,
    chat_id: 'mock_chat_id',
    plugins: [],
    memory: false,
    mode: {
      interactive: true,
      autonomous: false,
      recursionLimit: 15,
    },
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
    getAgentConfig: () => json_config,
    getDatabaseCredentials: () => database,
    getDatabase: () => new Map<string, Postgres>(),
    setDatabase: (databases: Map<string, Postgres>) => {
      console.log('Database set:', databases);
    },
  };
};
