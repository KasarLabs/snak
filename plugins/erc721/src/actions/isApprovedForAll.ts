import { Contract } from 'starknet';
import { StarknetAgentInterface } from '@snakagent/core';
import { INTERACT_ERC721_ABI } from '../abis/interact.js';
import { validateAndParseAddress } from 'starknet';
import { z } from 'zod';
import { isApprovedForAllSchema } from '../schemas/schema.js';

/**
 * Checks if an operator is approved to manage all tokens of an owner.
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {z.infer<typeof isApprovedForAllSchema>} params - Approval check parameters
 * @returns {Promise<string>} JSON string with approval status
 */
export const isApprovedForAll = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof isApprovedForAllSchema>
): Promise<string> => {
  try {
    if (
      !params?.ownerAddress ||
      !params?.operatorAddress ||
      !params?.contractAddress
    ) {
      throw new Error(
        'Owner address, operator address and contract address are required'
      );
    }

    const provider = agent.getProvider();

    const ownerAddress = validateAndParseAddress(params.ownerAddress);
    const operatorAddress = validateAndParseAddress(params.operatorAddress);
    const contractAddress = validateAndParseAddress(params.contractAddress);

    const contract = new Contract(
      INTERACT_ERC721_ABI,
      contractAddress,
      provider
    );

    const approvedResponse = await contract.isApprovedForAll(
      ownerAddress,
      operatorAddress
    );

    return JSON.stringify({
      status: 'success',
      isApproved: approvedResponse === true,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
