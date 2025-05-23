import { SnakAgentInterface } from '@snakagent/core';

export const getSpecVersion = async (agent: SnakAgentInterface) => {
  try {
    const provider = agent.getProvider();
    const specVersion = await provider.getSpecVersion();

    return JSON.stringify({
      status: 'success',
      specVersion: specVersion.toString(),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
