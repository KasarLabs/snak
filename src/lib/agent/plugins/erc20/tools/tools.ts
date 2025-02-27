import { StarknetToolRegistry } from 'src/lib/agent/tools/tools';

import {
  getAllowanceSchema,
  getTotalSupplySchema,
  transferFromSchema,
  getBalanceSchema,
  getOwnBalanceSchema,
  approveSchema,
  transferSchema,
  getMyGivenAllowanceSchema,
  getAllowanceGivenToMeSchema,
  deployERC20Schema,
} from '../schemas/schema';

import { getAllowance } from '../actions/getAllowance';
import { getTotalSupply } from '../actions/getTotaSupply';
import { transferFrom } from '../actions/transferFrom';
import { getBalance, getOwnBalance } from '../actions/getBalances';
import { approve } from '../actions/approve';
import { transfer } from '../actions/transfer';
import { getMyGivenAllowance } from '../actions/getAllowance';
import { getAllowanceGivenToMe } from '../actions/getAllowance';
import { deployERC20Contract } from '../actions/deployERC20';

export const registerERC20Tools = () => {
  StarknetToolRegistry.registerTool({
    name: 'get_allowance',
    plugins: 'erc20',
    description:
      'Get the amount of tokens that a spender is allowed to spend on behalf of an owner. Requires the token symbol (e.g., ETH, USDC), the owner address and the spender address.',
    schema: getAllowanceSchema,
    execute: getAllowance,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_my_given_allowance',
    plugins: 'erc20',
    description:
      'Get the amount of tokens that a spender is allowed to spend on your behalf. Requires the token symbol (e.g., ETH, USDC) and the spender address.',
    schema: getMyGivenAllowanceSchema,
    execute: getMyGivenAllowance,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_allowance_given_to_me',
    plugins: 'erc20',
    description:
      'Get the amount of tokens that a you are allowed to spend on the behalf of an owner. Requires the token symbol (e.g., ETH, USDC) and the owner address.',
    schema: getAllowanceGivenToMeSchema,
    execute: getAllowanceGivenToMe,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_total_supply',
    plugins: 'erc20',
    description: 'Get the total supply of an token token',
    schema: getTotalSupplySchema,
    execute: getTotalSupply,
  });

  StarknetToolRegistry.registerTool({
    name: 'transfer_from',
    plugins: 'erc20',
    description:
      'Transfer tokens from one address to another using an allowance',
    schema: transferFromSchema,
    execute: transferFrom,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_balance',
    plugins: 'erc20',
    description: 'Get the balance of an asset for a given wallet address',
    schema: getBalanceSchema,
    execute: getBalance,
  });

  StarknetToolRegistry.registerTool({
    name: 'get_own_balance',
    plugins: 'erc20',
    description: 'Get the balance of an asset in your wallet',
    schema: getOwnBalanceSchema,
    execute: getOwnBalance,
  });

  StarknetToolRegistry.registerTool({
    name: 'approve',
    plugins: 'erc20',
    description: 'Approve a spender to spend tokens on your behalf',
    schema: approveSchema,
    execute: approve,
  });

  StarknetToolRegistry.registerTool({
    name: 'transfer',
    plugins: 'erc20',
    description: 'Transfer ERC20 tokens to a specific address',
    schema: transferSchema,
    execute: transfer,
  });

  StarknetToolRegistry.registerTool({
    name: 'deploy_erc20',
    plugins: 'erc20',
    description:
      'Deploy a new ERC20 contract, returns the address of the deployed contract',
    schema: deployERC20Schema,
    execute: deployERC20Contract,
  });
};
