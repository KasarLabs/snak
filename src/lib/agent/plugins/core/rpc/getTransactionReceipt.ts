import { TransactionHashParams } from 'src/lib/agent/schemas/schema';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';

export const getTransactionReceipt = async (
  agent: StarknetAgentInterface,
  params: TransactionHashParams
) => {
  const provider = agent.getProvider();

  try {
    const { transactionHash } = params;
    const receipt = await provider.getTransactionReceipt(transactionHash);
    return JSON.stringify({
      status: 'success',
      receipt,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
