import { TransactionHashParams } from 'src/lib/agent/plugins/core/rpc/schema';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';

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
