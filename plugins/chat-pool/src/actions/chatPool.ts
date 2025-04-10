import { insertChatIntructionParams } from '../schema/index.js';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { chat } from '@snak/database/queries'

export const insertChatInstruction = async (
  agent: StarknetAgentInterface,
  params: insertChatIntructionParams
) => {
  try {
    const database = agent.getDatabaseByName('chat_pool_db');
    if (!database) {
      console.log('Database not found');
      return;
    }

    chat.insert_instruction(params.instruction);

    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', error_message: error });
  }
};

export const readChatPool = async (agent: StarknetAgentInterface) => {
  try {
    const database = agent.getDatabaseByName('chat_pool_db');
    if (!database) {
      console.log('Database not found');
      return;
    }

    const result = await database.select({
      FROM: ['snak_table_chat'],
      SELECT: ['*'],
    });
    const instructions: string[] = [];
    if (result.status === 'error') {
      throw new Error(result.error_message);
    }
    if (!result.query) {
      throw new Error('Error query response is empty.');
    }
    for (const row of result.query.rows) {
      instructions.push(JSON.stringify(row.instruction));
    }
    return JSON.stringify({
      status: 'success',
      instructions: instructions,
    });
  } catch (error) {
    console.log(error);
    return JSON.stringify({ status: 'error', error_message: error });
  }
};
