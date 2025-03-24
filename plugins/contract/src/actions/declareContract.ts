import { Account, constants } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager';
import { declareContractSchema } from '../schemas/schema';
import { getSierraCasmFromDB } from '../utils/db';

/**
 * Declares a contract on StarkNet
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {z.infer<typeof declareContractSchema>} params - Contract declaration parameters
 * @returns {Promise<string>} JSON string with declaration result or error
 */
export const declareContract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof declareContractSchema>
): Promise<string> => {
  try {
    const { sierraPath, casmPath } = await getSierraCasmFromDB(
      agent,
      params.projectName,
      params.contractName
    );

    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    const contractManager = new ContractManager(account);
    await contractManager.loadContractCompilationFiles(sierraPath, casmPath);

    const declareResponse = await contractManager.declareContract();

    return JSON.stringify({
      status: 'success',
      transactionHash: declareResponse.transactionHash,
      classHash: declareResponse.classHash,
      sierraPath: sierraPath,
      casmPath: casmPath,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'contract declaration',
    });
  }
};
