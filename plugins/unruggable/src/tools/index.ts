import { StarknetTool } from '@snakagent/core';
import {
  contractAddressSchema,
  launchOnEkuboSchema,
  createMemecoinSchema,
} from '../schema/index.js';
import { getLockedLiquidity } from '../actions/getLockedLiquidity.js';
import { isMemecoin } from '../actions/isMemecoin.js';
import { createMemecoin } from '../actions/createMemecoin.js';
import { launchOnEkubo } from '../actions/launchOnEkubo.js';

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  SnakToolRegistry.push({
    name: 'is_memecoin',
    plugins: 'unruggable',
    description: 'Check if address is a memecoin',
    schema: contractAddressSchema,
    execute: isMemecoin,
  });

  SnakToolRegistry.push({
    name: 'get_locked_liquidity',
    plugins: 'unruggable',
    description: 'Get locked liquidity info for token',
    schema: contractAddressSchema,
    execute: getLockedLiquidity,
  });

  SnakToolRegistry.push({
    name: 'create_memecoin',
    plugins: 'unruggable',
    description: 'Create a new memecoin using the Unruggable Factory',
    schema: createMemecoinSchema,
    execute: createMemecoin,
  });

  SnakToolRegistry.push({
    name: 'launch_on_ekubo',
    plugins: 'unruggable',
    description: 'Launch a memecoin on Ekubo DEX with concentrated liquidity',
    schema: launchOnEkuboSchema,
    execute: launchOnEkubo,
  });
};
