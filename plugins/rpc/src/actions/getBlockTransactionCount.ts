import { BlockIdParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getBlockTransactionCount = async (
  agent: StarknetAgentInterface,
  params: BlockIdParams
) => {
  const provider = agent.getProvider();
  return await provider.getBlockTransactionCount(params.blockId);
};
