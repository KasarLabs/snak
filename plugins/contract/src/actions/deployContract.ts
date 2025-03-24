import { Account, constants } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager';
import { deployContractSchema } from '../schemas/schema';
import { getSierraCasmFromDB } from '../utils/db';

/**
 * Deploys a contract on StarkNet using an existing class hash
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {z.infer<typeof deployContractSchema>} params - Contract deployment parameters
 * @returns {Promise<string>} JSON string with deployment result or error
 */
export const deployContract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deployContractSchema>
): Promise<string> => {
  try {
    if (!params?.classHash) {
      throw new Error('Class hash is required for deployment');
    }

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

    const { sierraPath, casmPath } = await getSierraCasmFromDB(
      agent,
      params.projectName,
      params.contractName
    );
    await contractManager.loadContractCompilationFiles(sierraPath, casmPath);
    await contractManager.loadAbiFile();

    const constructorParamDefs = contractManager.extractConstructorParams();
    const typedConstructorArgs = contractManager.convertConstructorArgs(
      constructorParamDefs,
      params.constructorArgs as string[]
    );

    const deployResponse = await contractManager.deployContract(
      params.classHash,
      typedConstructorArgs
    );

    return JSON.stringify({
      status: 'success',
      transactionHash: deployResponse.transactionHash,
      contractAddress: deployResponse.contractAddress,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'contract deployment',
    });
  }
};
