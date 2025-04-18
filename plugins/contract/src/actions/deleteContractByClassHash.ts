import { logger, StarknetAgentInterface } from '@kasarlabs/core';
('@kasarlabs/core');
import { z } from 'zod';
import { deleteContractByClassHashSchema } from '../schemas/schema.js';
import { contract } from '@kasarlabs/database/queries';

/**
 * Deletes a contract by its class hash
 * @param params The parameters
 * @returns The result of the operation
 */
export const deleteContractByClassHashAction = async (
  _agent: StarknetAgentInterface,
  params: z.infer<typeof deleteContractByClassHashSchema>
): Promise<string> => {
  try {
    logger.debug('\n Deleting contract by class hash');
    logger.debug(JSON.stringify(params, null, 2));

    await contract.deleteContract(params.classHash);

    return JSON.stringify({
      status: 'success',
      message: `Contract with class hash ${params.classHash} successfully deleted`,
      classHash: params.classHash,
    });
  } catch (error) {
    logger.error('Error deleting contract by class hash:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
