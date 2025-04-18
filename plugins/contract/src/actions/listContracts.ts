import { logger, StarknetAgentInterface } from '@snakagent/core';
('@snakagent/core');
import { listContractsSchema } from '../schemas/schema.js';
import { z } from 'zod';
import { contract } from '@snakagent/database/queries';

/**
 * List the declared contracts
 * @returns The result of the operation
 */
export const listDeclaredContracts = async (
  _agent: StarknetAgentInterface,
  _params: z.infer<typeof listContractsSchema>
): Promise<string> => {
  try {
    const contracts = await contract.selectContracts();

    return JSON.stringify({
      status: 'success',
      message:
        contracts.length > 0
          ? `Found ${contracts.length} contracts in the database`
          : 'No contracts found in the database',
      contracts: contracts,
    });
  } catch (error) {
    logger.error('Error listing contracts:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
