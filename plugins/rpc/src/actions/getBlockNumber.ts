import { StarknetAgentInterface } from '@snakagent/core';

export const getBlockNumber = async (agent: StarknetAgentInterface) => {
  const provider = agent.getProvider();
  console.log("this is the provider", provider);
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log('trying to get blockNumber', blockNumber);
    return JSON.stringify({
      status: 'success',
      blockNumber,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
