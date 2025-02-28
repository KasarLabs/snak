import { RpcProvider } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ARGENT_CLASS_HASH } from '../constant/contract';
import { AccountManager } from '../utils/AccountManager';
import { z } from 'zod';
import { accountDetailsSchema } from '../schemas/schema';

/**
 * Deploys an Argent account using Starknet agent.
 * @async
 * @function DeployArgentAccount
 * @param {StarknetAgentInterface} agent - The Starknet agent
 * @param {z.infer<typeof accountDetailsSchema>} params - Account details
 * @returns {Promise<string>} JSON string with deployment result
 * @throws {Error} If deployment fails
 */
export const DeployArgentAccount = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof accountDetailsSchema>
) => {
  try {
    const provider = agent.getProvider();

    const accountManager = new AccountManager(provider);
    const tx = await accountManager.deployAccount(ARGENT_CLASS_HASH, params);

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
 * Deploys an Argent account using RPC.
 * @async
 * @function DeployArgentAccountSignature
 * @param {z.infer<typeof accountDetailsSchema>} params - Account details
 * @returns {Promise<string>} JSON string with deployment result
 * @throws {Error} If deployment fails
 */
export const DeployArgentAccountSignature = async (
  params: z.infer<typeof accountDetailsSchema>
) => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const accountManager = new AccountManager(provider);
    const tx = await accountManager.deployAccount(ARGENT_CLASS_HASH, params);

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
