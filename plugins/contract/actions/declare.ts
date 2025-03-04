import { Account, constants } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager';
import { declareContractSchema } from '../schemas/schema';

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
    // Validate required parameters
    if (!params?.sierraPath || !params?.casmPath) {
      throw new Error('Sierra and CASM file paths are required');
    }

    // Set up provider and account
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey,
      undefined,
      constants.TRANSACTION_VERSION.V3
    );

    // Initialize contract manager and load contract files
    const contractManager = new ContractManager(account);
    await contractManager.loadContractCompilationFiles(
      params.sierraPath,
      params.casmPath
    );

    // Declare the contract
    const declareResponse = await contractManager.declareContract();
    
    console.log('Contract declaration result:', declareResponse);
    
    return JSON.stringify({
      status: 'success',
      transactionHash: declareResponse.transactionHash,
      classHash: declareResponse.classHash,
    });
  } catch (error) {
    console.error('Contract declaration failed:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'contract declaration'
    });
  }
};