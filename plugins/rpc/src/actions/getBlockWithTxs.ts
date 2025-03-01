import { BlockIdParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getBlockWithTxs = async (
  agent: StarknetAgentInterface,
  params: BlockIdParams
) => {
  const provider = agent.getProvider();

  try {
    const blockId = params?.blockId ?? 'latest';
    const block = await provider.getBlockWithTxs(blockId);
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
