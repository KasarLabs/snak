import { logger } from '@hijox/core';
import { insertChatInstruction, readChatPool } from '../actions/chatPool.js';
import { insertChatIntructionSchema } from '../schema/index.js';
import { StarknetAgentInterface, StarknetTool } from '@hijox/core';
import { chatPoolQueries } from '@hijox/database/queries';

export const registerTools = async (
  StarknetToolRegistry: StarknetTool[],
  agent: StarknetAgentInterface
) => {
  try {
    const chatpool = new chatPoolQueries(agent.getDatabaseCredentials());
    const db = agent.getDatabase();
    if (db.has('chatpool')) {
      throw new Error('Scarb database already exists');
    }
    db.set('chatpool', chatpool);
    agent.setDatabase(db);
  } catch (error) {
    logger.error('Failed to initialize scarb db: ', error);
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
