import { StarknetTool } from '@starknet-agent-kit/agents';
import {
  getBalanceSchema,
  Transferschema,
  getOwnBalanceSchema,
} from '../schema/index.js';
import { transfer } from '../actions/transfer.js';
import { getBalance, getOwnBalance } from '../actions/getBalances.js';

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
    description:
      'Get the balance of a cryptocurrency in your wallet. Extract the token symbol (like ETH, USDC) from the user query. Always use a valid token symbol.',
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
