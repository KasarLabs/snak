import { BlockIdParams } from 'src/lib/agent/schema';
import { StarknetAgentInterface } from '../../tools';

export const getBlockStateUpdate = async (agent: StarknetAgentInterface, params: BlockIdParams) => {
  const provider = agent.getProvider();

  try {
    const blockId = params?.blockId ?? 'latest';
    const block = await provider.getBlockStateUpdate(blockId);
    return JSON.stringify({
      status: 'success',
      block,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
