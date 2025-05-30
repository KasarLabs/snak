import { SnakAgentInterface } from '@snakagent/core';

export const getSyncingStats = async (agent: SnakAgentInterface) => {
  const provider = agent.getProvider();

  try {
    const syncingStats = await provider.getSyncingStats();
    return JSON.stringify({
      status: 'success',
      syncingStats,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
