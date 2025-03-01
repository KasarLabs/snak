import { BlockIdAndContractAddressParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getClassHashAt = async (
  agent: StarknetAgentInterface,
  params: BlockIdAndContractAddressParams
) => {
  try {
    const provider = agent.getProvider();
    const classHash = await provider.getClassHashAt(
      params.contractAddress,
      params.blockId
    );
    return JSON.stringify({
      status: 'success',
      classHash,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
