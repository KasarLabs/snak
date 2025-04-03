import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { deleteContractByClassHashSchema } from '../schemas/schema.js';
import { initializeContractDatabase, deleteContractByClassHash } from '../utils/db_init.js';

/**
 * Supprime un contrat par son classHash
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {z.infer<typeof deleteContractByClassHashSchema>} params - Paramètres avec le classHash à supprimer
 * @returns {Promise<string>} JSON string avec le résultat de l'opération
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