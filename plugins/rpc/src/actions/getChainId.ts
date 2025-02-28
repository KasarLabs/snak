import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getChainId = async (agent: StarknetAgentInterface) => {
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
