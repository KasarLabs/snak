import { insertChatIntructionParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
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

    const result = await database.insert({
      table_name: 'sak_table_chat',
      fields: new Map<string, string>([
        ['instruction', `'${params.instruction}'`],
      ]),
    });
    if (result.status === 'error') {
        console.log('Error : ', result.error_message);
      throw new Error(`Error : ${result.code} ${result.error_message}`);
    }
    console.log('Instruction inserted : ', result.query);
    return JSON.stringify({ status: 'success' });
  } catch (error) {
    console.log(error);
    return JSON.stringify({ status: 'error' });
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
      FROM: ['sak_table_chat'],
      SELECT: ['*'],
    });
    const instructions = [];
    if (result.status === 'error') {
      throw new Error(result.error_message);
    }
    if (!result.query) {
      throw new Error('Error query response is empty.');
    }
    for (const row of result.query.rows) {
      instructions.push(row.toString());
    }
    return JSON.stringify({ status: 'success', instructions: instructions });
  } catch (error) {
    console.log(error);
    return JSON.stringify({ status: 'error' });
  }
};
