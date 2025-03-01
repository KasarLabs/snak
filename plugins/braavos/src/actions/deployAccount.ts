import { RpcProvider } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { AccountManager } from '../utils/AccountManager';
import { z } from 'zod';
import { accountDetailsSchema } from '../schemas/schema';
import {
  BRAAVOS_ACCOUNT_CLASSHASH,
  BRAAVOS_INITIAL_CLASSHASH,
  BRAAVOS_PROXY_CLASSHASH,
} from '../constant/contract';

/**
 * Deploys a Braavos account using a Starknet agent.
 * @async
 * @function DeployBraavosAccount
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof accountDetailsSchema>} params - Account details
 * @returns {Promise<string>} JSON string with deployment status and transaction details
 * @throws {Error} If deployment fails
 */
export const DeployBraavosAccount = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof accountDetailsSchema>
) => {
  try {
    const provider = agent.getProvider();

    const accountManager = new AccountManager(
      provider,
      BRAAVOS_INITIAL_CLASSHASH,
      BRAAVOS_PROXY_CLASSHASH,
      BRAAVOS_ACCOUNT_CLASSHASH
    );

    const tx = await accountManager.deployAccount(params);

    return JSON.stringify({
      status: 'success',
      wallet: 'Braavos',
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
 * Deploys a Braavos account using direct RPC connection.
 * @async
 * @function DeployBraavosAccountSignature
 * @param {z.infer<typeof accountDetailsSchema>} params - Account details
 * @returns {Promise<string>} JSON string with deployment status and transaction details
 * @throws {Error} If deployment fails
 */
export const DeployBraavosAccountSignature = async (
  params: z.infer<typeof accountDetailsSchema>
) => {
  try {
    const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });

    const accountManager = new AccountManager(
      provider,
      BRAAVOS_INITIAL_CLASSHASH,
      BRAAVOS_PROXY_CLASSHASH,
      BRAAVOS_ACCOUNT_CLASSHASH
    );

    const tx = await accountManager.deployAccount(params);

    return JSON.stringify({
      status: 'success',
      wallet: 'Braavos',
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
