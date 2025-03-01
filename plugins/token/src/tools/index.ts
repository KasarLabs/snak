import { StarknetTool } from '@starknet-agent-kit/agents';
import { getBalanceSchema, Transferschema } from '../schema';
import { transfer } from '../actions/transfer';
import { getBalance, getOwnBalance } from '../actions/getBalances';
import { getOwnBalanceSchema } from '../schema';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'transfer',
    plugins: 'token',
    description: 'Transfer ERC20 tokens to a specific address',
    schema: Transferschema,
    execute: transfer,
  });

  StarknetToolRegistry.push({
    name: 'get_own_balance',
    plugins: 'token',
    description: 'Get the balance of an asset in your wallet',
    schema: getOwnBalanceSchema,
    execute: getOwnBalance,
  });

  StarknetToolRegistry.push({
    name: 'get_balance',
    plugins: 'token',
    description: 'Get the balance of an asset for a given wallet address',
    schema: getBalanceSchema,
    execute: getBalance,
  });
};
