import { GetTransactionByBlockIdAndIndexParams } from '../schema/index.js';
import { SnakAgentInterface } from '@snakagent/core';

export const getTransactionByBlockIdAndIndex = async (
  agent: SnakAgentInterface,
  params: GetTransactionByBlockIdAndIndexParams
) => {
  const provider = agent.getProvider();

  try {
    const { transactionIndex, blockId } = params;
    const transaction = await provider.getTransactionByBlockIdAndIndex(
      blockId,
      transactionIndex
    );
    return JSON.stringify({
      status: 'success',
      transaction,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
