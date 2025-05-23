import { SnakAgentInterface } from '@snakagent/core';

export const getChainId = async (agent: SnakAgentInterface) => {
  const provider = agent.getProvider();

  try {
    const chainId = await provider.getChainId();

    return JSON.stringify({
      status: 'success',
      chainId,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
