import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { listContractsSchema } from '../schemas/schema.js';
import { initializeContractDatabase } from '../utils/db_init.js';

/**
 * Liste les contrats enregistrés dans la base de données
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {z.infer<typeof listContractsSchema>} params - Filtres optionnels pour la liste
 * @returns {Promise<string>} JSON string avec la liste des contrats
 */
export const listDeclaredContracts = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof listContractsSchema>
): Promise<string> => {
  try {
    const database = agent.getDatabaseByName('contract_db');
    if (!database) {
      throw new Error('Database not found');
    }

    // Récupérer tous les contrats avec une requête simple
    const contractsResult = await database.select({
      SELECT: ['class_hash', 'declare_tx_hash'],
      FROM: ['contract']
    });

    if (!contractsResult.query?.rows.length) {
      return JSON.stringify({
        status: 'success',
        message: 'No contracts found in the database',
        contracts: [],
      });
    }

    const contracts = [];
    for (const contract of contractsResult.query.rows) {
      contracts.push({
        classHash: contract.class_hash,
        declareTxHash: contract.declare_tx_hash
      });
    }

    return JSON.stringify({
      status: 'success',
      message: `Found ${contracts.length} contracts in the database`,
      contracts: contracts,
    });
  } catch (error) {
    console.error('Error listing contracts:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}; 