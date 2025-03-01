import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getSyncingStats = async (agent: StarknetAgentInterface) => {
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
