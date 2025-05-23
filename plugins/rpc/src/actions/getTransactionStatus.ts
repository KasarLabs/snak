import { TransactionHashParams } from '../schema/index.js';
import { SnakAgentInterface } from '@snakagent/core';

export const getTransactionStatus = async (
  agent: SnakAgentInterface,
  params: TransactionHashParams
) => {
  try {
    const provider = agent.getProvider();
    const status = await provider.getTransactionStatus(params.transactionHash);
    return JSON.stringify({
      status: 'success',
      transactionStatus: status,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
