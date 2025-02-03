import { TransactionHashParams } from 'src/lib/agent/schemas/schema';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';

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
