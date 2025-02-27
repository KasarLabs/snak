import { Account, Contract, CallData, hash, RpcProvider } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { ContractManager } from '../utils/contractManager';
import { deployERC20Schema } from '../schemas/schema';
import { ERC20_CLASSHASH } from '../constant/constant';
import { DEPLOY_ERC20_ABI } from '../abis/deploy';
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

    console.log('🚀 Deploying ERC20 contract with args : ', params);
    const account = new Account(
        provider, 
        accountCredentials?.accountPublicKey,
        accountCredentials?.accountPrivateKey
    );

    const contractManager = new ContractManager(account);

    const response = await contractManager.deployContract(
      ERC20_CLASSHASH as string, 
      DEPLOY_ERC20_ABI,
      {
        name: params.name,
        symbol: params.symbol,
        fixed_supply: params.totalSupply,
        recipient: accountCredentials?.accountPublicKey
      },
    );

    const myTestContract = new Contract(
        DEPLOY_ERC20_ABI,
        response.contractAddress as string,
        provider
    );

    console.log('✅ Test Contract deployed at =', myTestContract.address);
    // if (response.contractAddress)
    //   addNewTokenToConstants(params.symbol, response.contractAddress);

    return JSON.stringify({
      status: 'success',
      transactionHash: response.transactionHash,
      contractAddress: response.contractAddress,
    });
  } catch (error) {
    console.log('Error:', error);
    return JSON.stringify({
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};