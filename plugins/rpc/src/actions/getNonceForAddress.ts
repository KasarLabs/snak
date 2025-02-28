import { BlockIdAndContractAddressParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { BlockNumber } from 'starknet';

export const getNonceForAddress = async (
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

    const contractClass = await provider.getNonceForAddress(
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
