import { Contract } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { INTERACT_ERC721_ABI } from '../abis/interact';
import { validateAndFormatTokenId } from '../utils/utils';
import { bigint, z } from 'zod';
import { ownerOfSchema } from '../schemas/schema';
import { bigintToHex } from '../utils/utils';
import { validateAndParseAddress } from 'starknet';

/**
 * Get the owner of the token.
 * @param agent The StarknetAgentInterface instance.
 * @param params The parameters for the getOwner function.
 * @returns A stringified JSON object with the status and the owner address.
 */
export const getOwner = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof ownerOfSchema>
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

    const ownerResponse = await contract.ownerOf(tokenId);

    return JSON.stringify({
      status: 'success',
      owner: bigintToHex(BigInt(ownerResponse)),
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
