import { Account, constants } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager.js';
import { declareContractSchema } from '../schemas/schema.js';
import { getSierraCasmFromDB } from '../utils/db.js';
import { initializeContractDatabase, saveContractDeclaration } from '../utils/db_init.js';

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
    console.log('\n➜ Declaring contract');
    console.log(JSON.stringify(params, null, 2));

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

    if (declareResponse.transactionHash && declareResponse.classHash) {
      await saveContractDeclaration(
        agent,
        declareResponse.classHash,
        declareResponse.transactionHash
      );
    }

    return JSON.stringify({
      status: 'success',
      transactionHash: declareResponse.transactionHash,
      classHash: declareResponse.classHash
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'contract declaration',
    });
  }
};
