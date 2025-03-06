import { Account, constants } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager';
import { deployContractSchema } from '../schemas/schema';

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
    
    if (params.abiPath) {
      await contractManager.loadAbiFile(params.abiPath);
    }
    else if (params.sierra && params.casm) {
      await contractManager.loadContractCompilationFiles(params.sierra, params.casm);
      await contractManager.loadAbiFile();
    }
    else {
      throw new Error('Either ABI path or Sierra and CASM paths are required');
    }
    console.log('ABI loaded:', contractManager.abi);

    const constructorParamDefs = contractManager.extractConstructorParams();

    const typedConstructorArgs = contractManager.convertConstructorArgs(
      constructorParamDefs,
      params.constructorArgs as string[]
    );

    console.log('Typed constructor arguments:', typedConstructorArgs);

    const deployResponse = await contractManager.deployContract(
      params.classHash,
      typedConstructorArgs
    );
    
    console.log('Contract deployment result:', deployResponse);
    
    return JSON.stringify({
      status: 'success',
      transactionHash: deployResponse.transactionHash,
      contractAddress: deployResponse.contractAddress,
    });
  } catch (error) {
    console.error('Contract deployment failed:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'contract deployment'
    });
  }
};