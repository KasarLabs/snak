import { Account, shortString } from 'starknet';
import { StarknetAgentInterface } from '@kasarlabs/agents';
import { ContractManager } from '../utils/contractManager.js';
import {
  ERC721_CLASSHASH_SEPOLIA,
  ERC721_CLASSHASH_MAINNET,
} from '../constant/constant.js';
import { deployERC721Schema } from '../schemas/schema.js';
import {
  DEPLOY_ERC721_ABI_SEPOLIA,
  DEPLOY_ERC721_ABI_MAINNET,
} from '../abis/deploy.js';
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

    const chainId = shortString.decodeShortString(await provider.getChainId());
    const classhash =
      chainId === 'SN_MAIN'
        ? ERC721_CLASSHASH_MAINNET
        : ERC721_CLASSHASH_SEPOLIA;
    const abi =
      chainId === 'SN_MAIN'
        ? DEPLOY_ERC721_ABI_MAINNET
        : DEPLOY_ERC721_ABI_SEPOLIA;

    const response = await contractManager.deployContract(
      classhash as string,
      abi,
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
