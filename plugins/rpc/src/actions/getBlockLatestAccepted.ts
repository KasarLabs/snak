import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getBlockLatestAccepted = async (agent: StarknetAgentInterface) => {
  const provider = agent.getProvider();

  try {
    const blockHashAndNumber = await provider.getBlockLatestAccepted();

    return JSON.stringify({
      status: 'success',
      blockHashAndNumber,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
