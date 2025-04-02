import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { ContractManager } from '../utils/contractManager';
import { Account, constants } from 'starknet';
import { getConstructorParamsSchema } from '../schemas/schema';
import { getSierraCasmFromDB } from '../utils/db';

/**
 * Retrieves the constructor parameters for a contract
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {z.infer<typeof getConstructorParamsSchema>} params - Parameters to retrieve constructor info
 * @returns {Promise<string>} JSON string with ordered constructor parameter names
 */
export const getConstructorParams = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getConstructorParamsSchema>
): Promise<string> => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();
    const account = new Account(
      provider,
      accountCredentials.accountPublicKey,
      accountCredentials.accountPrivateKey
    );

    const contractManager = new ContractManager(account);

    const { sierraPath, casmPath } = await getSierraCasmFromDB(
      agent,
      params.projectName,
      params.contractName
    );
    await contractManager.loadContractCompilationFiles(sierraPath, casmPath);
    await contractManager.loadAbiFile();

    const constructorParams = contractManager.extractConstructorParams();

    return JSON.stringify({
      status: 'success',
      constructorParams: constructorParams.map((param) => param.name),
      paramCount: constructorParams.length,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      step: 'getting constructor parameters',
    });
  }
};
