import { Account, constants } from 'starknet';
import { StarknetAgentInterface } from '@hijox/core';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager.js';
import { declareContractSchema } from '../schemas/schema.js';
import { getSierraCasmFromDB } from '../utils/db.js';
import { logger } from '@hijox/core';
import { contract } from '@hijox/database/queries';

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
    logger.debug('\n Declaring contract');
    logger.debug(JSON.stringify(params, null, 2));

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
      await contract.insertContract({
        class_hash: declareResponse.classHash,
        declare_tx_hash: declareResponse.transactionHash,
      });
    }

    return JSON.stringify({
      status: 'success',
      transactionHash: declareResponse.transactionHash,
      classHash: declareResponse.classHash,
    });
  } catch (error) {
    logger.error(error.message);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'contract declaration',
    });
  }
};
