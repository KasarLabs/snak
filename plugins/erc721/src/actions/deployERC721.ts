import { Account } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ContractManager } from '../utils/contractManager';
import { ERC721_CLASSHASH } from '../constant/constant';
import { deployERC721Schema } from '../schemas/schema';
import { DEPLOY_ERC721_ABI } from '../abis/deploy';
import { z } from 'zod';

/**
 * Deploys an ERC721 contract.
 * @param agent - A StarknetAgentInterface instance.
 * @param params - An object containing the contract's name, symbol, base URI, and total supply.
 * @returns A stringified JSON object containing the status, transaction hash, and contract address.
 */
export const deployERC721Contract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deployERC721Schema>
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const account = new Account(
      provider,
      accountCredentials?.accountPublicKey,
      accountCredentials?.accountPrivateKey
    );

    const contractManager = new ContractManager(account);

    const response = await contractManager.deployContract(
      ERC721_CLASSHASH as string,
      DEPLOY_ERC721_ABI,
      {
        name: params.name,
        symbol: params.symbol,
        base_uri: params.baseUri,
        total_supply: params.totalSupply,
        recipient: accountCredentials?.accountPublicKey,
      }
    );

    return JSON.stringify({
      status: 'success',
      transactionHash: response.transactionHash,
      contractAddress: response.contractAddress,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
