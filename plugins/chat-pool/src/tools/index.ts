import { insertChatInstruction, readChatPool } from '../actions/chatPool.js';
import { insertChatIntructionSchema } from '../schema/index.js';
import {
  PostgresAdaptater,
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/core';

const initializeTools = async (
  agent: StarknetAgentInterface
): Promise<PostgresAdaptater | undefined> => {
  try {
    const database = await agent.createDatabase('chat_pool_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const result = await database.createTable({
      table_name: 'snak_table_chat',
      if_not_exist: false,
      fields: new Map<string, string>([
        ['id', 'SERIAL PRIMARY KEY'],
        ['instruction', 'VARCHAR(255) NOT NULL'],
      ]),
    });
    if (result.status === 'error') {
      if (result.code === '42P07') {
        database.addExistingTable({
          table_name: 'snak_table_chat',
          if_not_exist: false,
          fields: new Map<string, string>([
            ['id', 'SERIAL PRIMARY KEY'],
            ['instruction', 'VARCHAR(255) NOT NULL'],
          ]),
        });
        return database;
      } else {
        throw new Error(`Error ${result.code} : ${result.error_message}`);
      }
    }
    return database;
  } catch (error) {
    console.error(error);
  }
};

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  const database_instance = await initializeTools(agent);
  if (!database_instance) {
    console.error('Error while initializing database');
    return;
  }
  StarknetToolRegistry.push({
    name: 'insert_chat_instruction',
    plugins: 'chat-pool',
    description: 'Insert a chat instruction in a database',
    schema: insertChatIntructionSchema,
    execute: insertChatInstruction,
  });

  StarknetToolRegistry.push({
    name: 'read_chat_pool',
    plugins: 'chat-pool',
    description: 'read the chat pool return all the instructions',
    execute: readChatPool,
  });
};
