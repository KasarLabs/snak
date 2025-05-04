import { StarknetAgentInterface } from '../../../../agents/src/index';
import { RpcProvider, Contract } from 'starknet';
import { z } from 'zod';

export const getBalanceSchema = z.object({
  address: z.string().describe('Starknet wallet address to query balance for'),
});

export type GetBalanceInput = z.infer<typeof getBalanceSchema>;

export async function getBalance(
  agent: StarknetAgentInterface,
  params: GetBalanceInput
) {
  const { address } = params;

  const provider = new RpcProvider({
    nodeUrl: process.env.STARKNET_RPC_URL || '',
  });

  try {
    const { abi } = await provider.getClassAt(address);
    if (abi === undefined) {
      throw new Error('no abi');
    }

    const myContract = new Contract(abi, address, provider);
    const balance = await myContract.get_balance();
    return {
      balance: balance.toString(),
      address,
    };
  } catch (error) {
    console.error('Error fetching balance:', error);
    throw new Error(`Failed to fetch balance for address ${address}`);
  }
}
