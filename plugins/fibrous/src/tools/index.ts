import { StarknetTool } from '@snakagent/core';
import { swapSchema } from '../schema/index.js';
import { swapTokensFibrous } from '../actions/swap.js';
import {
  batchSwapSchema,
  routeSchema,
  RouteSchemaType,
} from '../schema/index.js';
import { batchSwapTokens } from '../actions/batchSwap.js';
import { getRouteFibrous } from '../actions/fetchRoute.js';

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  SnakToolRegistry.push({
    name: 'fibrous_swap',
    plugins: 'fibrous',
    description: 'Swap a token for another token',
    schema: swapSchema,
    execute: swapTokensFibrous,
  });

  SnakToolRegistry.push({
    name: 'fibrous_batch_swap',
    plugins: 'fibrous',
    description: 'Swap multiple tokens for another token',
    schema: batchSwapSchema,
    execute: batchSwapTokens,
  });

  SnakToolRegistry.push({
    name: 'fibrous_get_route',
    plugins: 'fibrous',
    description: 'Get a specific route for swapping tokens',
    schema: routeSchema,
    execute: async (params) => {
      return getRouteFibrous(params as unknown as RouteSchemaType);
    },
  });
};
