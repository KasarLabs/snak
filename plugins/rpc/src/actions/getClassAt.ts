import { BlockNumber } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { GetClassAtParams } from '../schema';

export const getClassAt = async (
  agent: StarknetAgentInterface,
  params: GetClassAtParams
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

    const contractClass = await provider.getClassAt(
      params.contractAddress,
      blockIdentifier
    );

    return JSON.stringify({
      status: 'success',
      contractClass,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
