import { StarknetTool } from '@starknet-agent-kit/agents';

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
} from '../schemas/schema.js';

import { getAllowance } from '../actions/getAllowance.js';
import { getTotalSupply } from '../actions/getTotaSupply.js';
import { transferFrom } from '../actions/transferFrom.js';
import { getBalance, getOwnBalance } from '../actions/getBalances.js';
import { approve } from '../actions/approve.js';
import { transfer } from '../actions/transfer.js';
import { getMyGivenAllowance } from '../actions/getAllowance.js';
import { getAllowanceGivenToMe } from '../actions/getAllowance.js';
import { deployERC20Contract } from '../actions/deployERC20.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'erc20_get_allowance',
    plugins: 'erc20',
    description:
      'Get the amount of tokens that a spender is allowed to spend on behalf of an owner. Requires the token symbol (e.g., ETH, USDC), the owner address and the spender address.',
    schema: getAllowanceSchema,
    execute: getAllowance,
  });

  StarknetToolRegistry.push({
    name: 'erc20_get_my_given_allowance',
    plugins: 'erc20',
    description:
      'Get the amount of tokens that a spender is allowed to spend on your behalf. Requires the token symbol (e.g., ETH, USDC) and the spender address.',
    schema: getMyGivenAllowanceSchema,
    execute: getMyGivenAllowance,
  });

  StarknetToolRegistry.push({
    name: 'erc20_get_allowance_given_to_me',
    plugins: 'erc20',
    description:
      'Get the amount of tokens that a you are allowed to spend on the behalf of an owner. Requires the token symbol (e.g., ETH, USDC) and the owner address.',
    schema: getAllowanceGivenToMeSchema,
    execute: getAllowanceGivenToMe,
  });

  StarknetToolRegistry.push({
    name: 'erc20_get_total_supply',
    plugins: 'erc20',
    description: 'Get the total supply of an token token',
    schema: getTotalSupplySchema,
    execute: getTotalSupply,
  });

  StarknetToolRegistry.push({
    name: 'erc20_transfer_from',
    plugins: 'erc20',
    description:
      'Transfer tokens from one address to another using an allowance',
    schema: transferFromSchema,
    execute: transferFrom,
  });

  StarknetToolRegistry.push({
    name: 'erc20_get_balance',
    plugins: 'erc20',
    description: 'Get the balance of an asset for a given wallet address',
    schema: getBalanceSchema,
    execute: getBalance,
  });

  StarknetToolRegistry.push({
    name: 'erc20_get_own_balance',
    plugins: 'erc20',
    description: 'Get the balance of an asset in your wallet',
    schema: getOwnBalanceSchema,
    execute: getOwnBalance,
  });

  StarknetToolRegistry.push({
    name: 'erc20_approve',
    plugins: 'erc20',
    description: 'Approve a spender to spend tokens on your behalf',
    schema: approveSchema,
    execute: approve,
  });

  StarknetToolRegistry.push({
    name: 'erc20_transfer',
    plugins: 'erc20',
    description: 'Transfer ERC20 tokens to a specific address',
    schema: transferSchema,
    execute: transfer,
  });

  StarknetToolRegistry.push({
    name: 'erc20_deploy_new_contract',
    plugins: 'erc20',
    description:
      'Create and deploy a new ERC20 contract, returns the address of the deployed contract',
    schema: deployERC20Schema,
    execute: deployERC20Contract,
  });
};
