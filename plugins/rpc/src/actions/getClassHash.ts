import { BlockIdAndContractAddressParams } from '../schema';
import { BlockNumber } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getClassHashAt = async (
  agent: StarknetAgentInterface,
  params: BlockIdAndContractAddressParams
) => {
  const provider = agent.getProvider();
  try {
    let blockIdentifier: BlockNumber | string = params.blockId || 'latest';

    if (
      typeof blockIdentifier === 'string' &&
      !isNaN(Number(blockIdentifier)) &&
      blockIdentifier !== 'latest'
    ) {
      blockIdentifier = Number(blockIdentifier);
    }

    const classHash = await provider.getClassHashAt(
      params.contractAddress,
      blockIdentifier
    );

    return JSON.stringify({
      status: 'success',
      classHash,
    });
  } catch (error) {
    console.error('GetClassHash error:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
