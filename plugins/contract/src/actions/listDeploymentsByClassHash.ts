import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { z } from 'zod';
import { listDeploymentsByClassHashSchema } from '../schemas/schema.js';
import { initializeContractDatabase } from '../utils/db_init.js';

/**
 * Liste tous les contrats déployés pour un classHash spécifique
 * @param {StarknetAgentInterface} agent - Starknet agent interface
 * @param {z.infer<typeof listDeploymentsByClassHashSchema>} params - Paramètres avec le classHash à rechercher
 * @returns {Promise<string>} JSON string avec la liste des contrats déployés
 */
export const listDeploymentsByClassHash = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof listDeploymentsByClassHashSchema>
): Promise<string> => {
  try {
    const database = agent.getDatabaseByName('contract_db');
    if (!database) {
      throw new Error('Database not found');
    }

    const contractResult = await database.select({
      SELECT: ['id'],
      FROM: ['contract'],
      WHERE: [`class_hash = '${params.classHash}'`]
    });
    
    if (!contractResult.query?.rows.length) {
      return JSON.stringify({
        status: 'success',
        message: `No contract found with class hash ${params.classHash}`,
        deployments: [],
      });
    }

    const contractId = contractResult.query.rows[0].id;

    const deploymentsResult = await database.select({
      SELECT: ['contract_address', 'deploy_tx_hash'],
      FROM: ['deployment'],
      WHERE: [`contract_id = ${contractId}`]
    });

    if (!deploymentsResult.query?.rows.length) {
      return JSON.stringify({
        status: 'success',
        message: `No deployments found for contract with class hash ${params.classHash}`,
        deployments: [],
      });
    }

    const deployments = [];
    for (const deployment of deploymentsResult.query.rows) {
      deployments.push({
        contractAddress: deployment.contract_address,
        deployTxHash: deployment.deploy_tx_hash
      });
    }

    return JSON.stringify({
      status: 'success',
      message: `Found ${deployments.length} deployments for contract with class hash ${params.classHash}`,
      classHash: params.classHash,
      deployments: deployments,
    });
  } catch (error) {
    console.error('Error listing deployments by class hash:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}; 