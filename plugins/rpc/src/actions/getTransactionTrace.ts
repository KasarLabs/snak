import { TransactionHashParams } from '../schema/index.js';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getTransactionTrace = async (
  agent: StarknetAgentInterface,
  params: TransactionHashParams
) => {
  const provider = agent.getProvider();

  try {
    const { transactionHash } = params;
    const transactionTrace =
      await provider.getTransactionTrace(transactionHash);
    return JSON.stringify({
      status: 'success',
      transactionTrace,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
