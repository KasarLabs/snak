import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { WithdrawTroveParams } from '../schemas';
import { createTroveManager } from '../utils/troveManager';

export const withdrawTrove = async (
  agent: StarknetAgentInterface,
  params: WithdrawTroveParams
): Promise<string> => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const troveManager = createTroveManager(agent, accountAddress);
    const result = await troveManager.withdrawTransaction(params, agent);
    return JSON.stringify({
      status: 'success',
      data: result,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
