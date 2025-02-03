import { BlockIdParams } from 'src/lib/agent/schemas/schema';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';

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
