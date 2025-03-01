import { BlockIdAndContractAddressParams } from '../schema';
import { BlockNumber } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getClass = async (
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

    const contractClass = await provider.getClass(
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
