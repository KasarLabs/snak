import { BlockIdParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getBlockTransactionsTraces = async (
  agent: StarknetAgentInterface,
  params: BlockIdParams
) => {
  const provider = agent.getProvider();

  try {
    const { blockId } = params;
    const transactionTraces =
      await provider.getBlockTransactionsTraces(blockId);
    return JSON.stringify({
      status: 'success',
      transactionTraces,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
