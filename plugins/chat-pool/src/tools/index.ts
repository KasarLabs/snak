import { insertChatInstruction, readChatPool } from '../actions/chatPool.js';
import { insertChatIntructionSchema } from '../schema/index.js';
import { StarknetTool } from '@snakagent/core';
import { chat } from '@snakagent/database/queries';

export const registerTools = async (StarknetToolRegistry: StarknetTool[]) => {
  try {
    chat.init();
  } catch (error) {
    console.error('Failed to initialize chat-pool db: ', error);
    throw error;
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
