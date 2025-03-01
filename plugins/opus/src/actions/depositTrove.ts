import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { DepositTroveParams } from '../schemas';
import { createTroveManager } from '../utils/troveManager';

export const depositTrove = async (
  agent: StarknetAgentInterface,
  params: DepositTroveParams
): Promise<string> => {
  const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

  try {
    const troveManager = createTroveManager(agent, accountAddress);
    const result = await troveManager.depositTransaction(params, agent);
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
