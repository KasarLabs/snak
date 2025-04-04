import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { deleteContractByClassHashSchema } from '../schemas/schema.js';
import { deleteContractByClassHash } from '../utils/db_init.js';

/**
 * Deletes a contract by its class hash
 * @param agent The Starknet agent
 * @param params The parameters
 * @returns The result of the operation
 */
export const deleteContractByClassHashAction = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deleteContractByClassHashSchema>
): Promise<string> => {
  try {
    console.log('\n➜ Deleting contract by class hash');
    console.log(JSON.stringify(params, null, 2));
    
    const result = await deleteContractByClassHash(agent, params.classHash);

    if (!result.success) {
      return JSON.stringify({
        status: 'failure',
        error: result.message,
      });
    }

    return JSON.stringify({
      status: 'success',
      message: result.message,
      classHash: params.classHash,
    });
  } catch (error) {
    console.error('Error deleting contract by class hash:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}; 