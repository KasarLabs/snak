import { RpcProvider } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { ARGENTX_CLASSHASH } from '../constant/contract';
import { AccountManager } from '../utils/AccountManager';
import { z } from 'zod';
import { accountDetailsSchema } from '../schemas/schema';

/**
 * Deploys an ArgentX account using Starknet agent.
 * @async
 * @function DeployAXAccount
 * @param {StarknetAgentInterface} agent - The Starknet agent
 * @param {z.infer<typeof accountDetailsSchema>} params - Account details
 * @returns {Promise<string>} JSON string with deployment result
 * @throws {Error} If deployment fails
 */
export const DeployAXAccount = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof accountDetailsSchema>
) => {
  try {
    const provider = agent.getProvider();

    const accountManager = new AccountManager(provider);
    const tx = await accountManager.deployAccount(ARGENTX_CLASSHASH, params);

    return JSON.stringify({
      status: 'success',
      wallet: 'AX',
      transaction_hash: tx.transactionHash,
      contract_address: tx.contractAddress,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Deploys an ArgentX account using RPC.
 * @async
 * @function DeployAXAccountSignature
 * @param {z.infer<typeof accountDetailsSchema>} params - Account details
 * @returns {Promise<string>} JSON string with deployment result
 * @throws {Error} If deployment fails
 */
export const DeployAXAccountSignature = async (
  params: z.infer<typeof accountDetailsSchema>
) => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const accountManager = new AccountManager(provider);
    const tx = await accountManager.deployAccount(ARGENTX_CLASSHASH, params);

    return JSON.stringify({
      status: 'success',
      wallet: 'AX',
      transaction_hash: tx.transactionHash,
      contract_address: tx.contractAddress,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
