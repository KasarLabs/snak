import { logger, StarknetAgentInterface } from '@starknet-agent-kit/core';
('@starknet-agent-kit/core');
import { listContractsSchema } from '../schemas/schema.js';
import { z } from 'zod';

/**
 * List the declared contracts
 * @param agent The Starknet agent
 * @param params The parameters
 * @returns The result of the operation
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

    const contractsResult = await database.select({
      SELECT: ['class_hash', 'declare_tx_hash'],
      FROM: ['contract'],
    });

    const contracts = [];
    for (const contract of contractsResult.query?.rows || []) {
      contracts.push({
        classHash: contract.class_hash,
        declareTxHash: contract.declare_tx_hash,
      });
    }

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
