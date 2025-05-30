import { logger, SnakAgentInterface } from '@snakagent/core';
import { z } from 'zod';
import { listDeploymentsByClassHashSchema } from '../schemas/schema.js';
import { contract } from '@snakagent/database/queries';

/**
 * List the deployments by class hash
 * @param agent The Starknet agent
 * @param params The parameters
 * @returns The result of the operation
 */
export const listDeploymentsByClassHash = async (
  _agent: SnakAgentInterface,
  params: z.infer<typeof listDeploymentsByClassHashSchema>
): Promise<string> => {
  try {
    const c = await contract.selectContract(params.classHash);
    if (!c) {
      return JSON.stringify({
        status: 'success',
        message: `No contract found with class hash ${params.classHash}`,
        deployments: [],
      });
    }

    const deployments = await contract.selectDeployments(params.classHash);
    return JSON.stringify({
      status: 'success',
      message:
        deployments.length > 0
          ? `Found ${deployments.length} deployments for contract with class hash ${params.classHash}`
          : `No deployments found for contract with class hash ${params.classHash}`,
      classHash: params.classHash,
      deployments: deployments,
    });
  } catch (error) {
    logger.error('Error listing deployments by class hash:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
