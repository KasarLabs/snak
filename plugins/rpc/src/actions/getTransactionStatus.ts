import { TransactionHashParams } from '../schema';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

export const getTransactionStatus = async (
  agent: StarknetAgentInterface,
  params: TransactionHashParams
) => {
  try {
    const provider = agent.getProvider();
    const status = await provider.getTransactionStatus(params.transactionHash);
    return JSON.stringify({
      status: 'success',
      transactionStatus: status,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
