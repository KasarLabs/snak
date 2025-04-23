import { Account, shortString, cairo } from 'starknet';
import { StarknetAgentInterface } from '@snakagent/core';
import { ContractManager } from '../utils/contractManager.js';
import { deployERC20Schema } from '../schemas/schema.js';
import {
  ERC20_CLASSHASH_SEPOLIA,
  ERC20_CLASSHASH_MAINNET,
} from '../constant/constant.js';
import { NEW_ERC20_ABI_SEPOLIA, NEW_ERC20_ABI_MAINNET } from '../abis/new.js';
import { z } from 'zod';

/**
 * Deploys a new ERC20 token contract on StarkNet
 * @param {StarknetAgentInterface} agent - StarkNet agent interface providing access to provider and credentials
 * @param {z.infer<typeof deployERC20Schema>} params - ERC20 deployment parameters validated by Zod schema
 * @returns {Promise<string>} JSON stringified response with deployment status and contract details
 * @throws {Error} If deployment fails
 */
export const deployERC20Contract = async (
  agent: StarknetAgentInterface,
  params: z.infer<typeof deployERC20Schema>
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
      chainId === 'SN_MAIN' ? ERC20_CLASSHASH_MAINNET : ERC20_CLASSHASH_SEPOLIA;
    const abi =
      chainId === 'SN_MAIN' ? NEW_ERC20_ABI_MAINNET : NEW_ERC20_ABI_SEPOLIA;

    const response = await contractManager.deployContract(
      classhash as string,
      abi,
      [
        params.name,
        params.symbol,
        cairo.uint256(params.totalSupply.toString()),
        accountCredentials?.accountPublicKey,
      ]
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
