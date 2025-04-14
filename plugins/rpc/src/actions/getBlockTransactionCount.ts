import { BlockIdParams } from '../schema/index.js';
import { StarknetAgentInterface } from '@hijox/agents';

export const getBlockTransactionCount = async (
  agent: StarknetAgentInterface,
  params: BlockIdParams
) => {
  const provider = agent.getProvider();
  return await provider.getBlockTransactionCount(params.blockId);
};
