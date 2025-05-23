import { TransactionHashParams } from '../schema/index.js';
import { SnakAgentInterface } from '@snakagent/core';

export const getTransactionReceipt = async (
  agent: SnakAgentInterface,
  params: TransactionHashParams
) => {
  const provider = agent.getProvider();

  try {
    const { transactionHash } = params;
    const receipt = await provider.getTransactionReceipt(transactionHash);
    return JSON.stringify({
      status: 'success',
      receipt,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
