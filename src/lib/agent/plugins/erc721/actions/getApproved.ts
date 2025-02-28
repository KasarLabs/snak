import { Contract } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { INTERACT_ERC721_ABI } from '../abis/interact';
import { validateAndFormatTokenId } from '../utils/utils';
import { z } from 'zod';
import { getApprovedSchema } from '../schemas/schema';
import { validateAndParseAddress } from 'starknet';

/**
 * Get the address that has been approved to transfer the token.
 * @param agent The StarknetAgentInterface instance.
 * @param params The parameters for the getApproved function.
 * @returns A stringified JSON object with the status and the approved address.
 */
export const getApproved = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof getApprovedSchema>
): Promise<string> => {
  try {
    if (!params?.tokenId || !params?.contractAddress) {
      throw new Error('Both token ID and contract address are required');
    }

    const provider = agent.getProvider();

    const contractAddress = validateAndParseAddress(params.contractAddress);
    const tokenId = validateAndFormatTokenId(params.tokenId);

    const contract = new Contract(
      INTERACT_ERC721_ABI,
      contractAddress,
      provider
    );

    const approvedResponse = await contract.getApproved(tokenId);

    return JSON.stringify({
      status: 'success',
      approved: approvedResponse.toString(),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
