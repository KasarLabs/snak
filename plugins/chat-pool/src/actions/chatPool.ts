import { insertChatIntructionParams } from '../schema/index.js';
import { StarknetAgentInterface } from '@kasarlabs/core';
import { chat } from '@kasarlabs/database/queries';

export const insertChatInstruction = async (
  _agent: StarknetAgentInterface,
  params: insertChatIntructionParams
) => {
  try {
    chat.insert_instruction(params.instruction);

    return JSON.stringify({ status: 'success' });
  } catch (error) {
    return JSON.stringify({ status: 'error', error_message: error });
  }
};

export const readChatPool = async (_agent: StarknetAgentInterface) => {
  try {
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
