import { SnakAgentInterface } from '@snakagent/core';
import { BorrowTroveParams } from '../schemas/index.js';
import { createTroveManager } from '../utils/troveManager.js';

export const borrowTrove = async (
  agent: SnakAgentInterface,
  params: BorrowTroveParams
): Promise<string> => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const troveManager = createTroveManager(agent, accountAddress);
    const result = await troveManager.borrowTransaction(params, agent);
    return JSON.stringify({
      status: 'success',
      data: result,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
