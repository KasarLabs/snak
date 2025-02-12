import { RpcProvider } from 'starknet';
import { StarknetAgentInterface } from 'src/lib/agent/tools/tools';
import { okx_classhash } from '../constant/contract';
import { AccountManager } from '../../core/account/utils/AccountManager';
import { AccountDetails } from '../../core/account/types/accounts';
  
export const DeployOKXAccount = async (
    agent: StarknetAgentInterface,
    params: AccountDetails
  ) => {
    try {
        const provider = agent.getProvider();
        
        const accountManager = new AccountManager(provider);
        const tx = await accountManager.deployAccount(okx_classhash, params);

        console.log('✅ OKX wallet deployed at:', tx.contractAddress);
        console.log('✅ Transaction hash:', tx.transactionHash);

        return JSON.stringify({
            status: 'success',
            wallet: 'OKX',
            transaction_hash: tx.transactionHash,
            contract_address: tx.contractAddress,
        });
    } catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
  

export const DeployOKXAccountSignature = async (
    params: AccountDetails
  ) => {
    try {
        const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        
        const accountManager = new AccountManager(provider);
        const tx = await accountManager.deployAccount(okx_classhash, params);

        console.log('✅ OKX wallet deployed at:', tx.contractAddress);
        console.log('✅ Transaction hash:', tx.transactionHash);

        return JSON.stringify({
            status: 'success',
            wallet: 'OKX',
            transaction_hash: tx.transactionHash,
            contract_address: tx.contractAddress,
        });
    } catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
  };
