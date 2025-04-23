import { insertChatIntructionParams } from '../schema/index.js';
import { StarknetAgentInterface } from '@hijox/core';
import { chatPoolQueries } from '@hijox/database/queries';

export const insertChatInstruction = async (
  _agent: StarknetAgentInterface,
  params: insertChatIntructionParams
) => {
  try {
    const chat = _agent.getDatabase().get('chatpool') as chatPoolQueries;
    if (!chat) {
      throw new Error('Chat database not found');
    }
    chat.insert_instruction(params.instruction);

    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', error_message: error });
  }
};

export const readChatPool = async (_agent: StarknetAgentInterface) => {
  try {
    const chat = _agent.getDatabase().get('chatpool') as chatPoolQueries;
    if (!chat) {
      throw new Error('Chat database not found');
    }
    return JSON.stringify({
      status: 'success',
      instructions: (await chat.select_instructions()).map(
        (row) => row.instruction
      ),
    });
  } catch (error) {
    console.log(error);
    return JSON.stringify({ status: 'error', error_message: error });
  }
};
