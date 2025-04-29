import { StarknetAgentInterface } from '@snakagent/core';

export const getBlockNumber = async (agent: StarknetAgentInterface) => {
  const provider = agent.getProvider();
  console.log('this is the provider', provider);
  console.log('this is the agent', agent);
  try {
    console.log('Before calling getBlockNumber');
    const blockNumber = await provider.getBlockNumber();
    console.log('Block number received:', blockNumber);
    return JSON.stringify({
      status: 'success',
      blockNumber,
    });
  } catch (error) {
    console.error('Error getting block number:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
