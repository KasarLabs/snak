import { StarknetTool } from '@snakagent/core';
import { routeSchema, swapSchema } from '../schema/index.js';
import { swapTokens } from '../actions/swap.js';
import { getRoute } from '../actions/fetchRoute.js';

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  SnakToolRegistry.push({
    name: 'avnu_swap_tokens',
    plugins: 'avnu',
    description: 'Swap a specified amount of one token for another token',
    schema: swapSchema,
    execute: swapTokens,
  });

  SnakToolRegistry.push({
    name: 'avnu_get_route',
    plugins: 'avnu',
    description: 'Get a specific route',
    schema: routeSchema,
    execute: getRoute,
  });
};
