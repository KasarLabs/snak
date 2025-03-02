import { Account, shortString } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ContractManager } from '../utils/contractManager';
import { deployERC20Schema } from '../schemas/schema';
import { ERC20_CLASSHASH_SEPOLIA, ERC20_CLASSHASH_MAINNET } from '../constant/constant';
import { DEPLOY_ERC20_ABI_SEPOLIA, DEPLOY_ERC20_ABI_MAINNET } from '../abis/deploy';
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
    const classhash = chainId === 'SN_MAIN' ? ERC20_CLASSHASH_MAINNET : ERC20_CLASSHASH_SEPOLIA;
    const abi = chainId === 'SN_MAIN' ? DEPLOY_ERC20_ABI_MAINNET : DEPLOY_ERC20_ABI_SEPOLIA;

    const response = await contractManager.deployContract(
      classhash as string,
      abi,
      {
        name: params.name,
        symbol: params.symbol,
        fixed_supply: params.totalSupply,
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
