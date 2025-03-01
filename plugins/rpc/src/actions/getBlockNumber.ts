import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getBlockNumber = async (agent: StarknetAgentInterface) => {
  const provider = agent.getProvider();

  try {
    const blockNumber = await provider.getBlockNumber();

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
