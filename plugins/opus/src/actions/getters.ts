import { SnakAgentInterface } from '@snakagent/core';
import { GetTroveHealthParams, GetUserTrovesParams } from '../schemas/index.js';
import { createTroveManager } from '../utils/troveManager.js';

export const getUserTroves = async (
  agent: SnakAgentInterface,
  params: GetUserTrovesParams
): Promise<string> => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const TroveManager = createTroveManager(agent, accountAddress);
    const result = await TroveManager.getUserTroves(params);
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

export const getTroveHealth = async (
  agent: SnakAgentInterface,
  params: GetTroveHealthParams
): Promise<string> => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const troveManager = createTroveManager(agent, accountAddress);
    const result = await troveManager.getTroveHealth(params);
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

export const getBorrowFee = async (
  agent: SnakAgentInterface
): Promise<string> => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const TroveManager = createTroveManager(agent, accountAddress);
    const result = await TroveManager.getBorrowFee();
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
