import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { swapSchema } from '../schema/index.js';
import { swapTokensFibrous } from '../actions/swap.js';
import { batchSwapSchema, routeSchema } from '../schema/index.js';
import { batchSwapTokens } from '../actions/batchSwap.js';
import { getRouteFibrous } from '../actions/fetchRoute.js';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'swap',
    plugins: 'fibrous',
    description: 'Swap a token for another token',
    schema: swapSchema,
    execute: swapTokensFibrous,
  });

  StarknetToolRegistry.push({
    name: 'batch_swap',
    plugins: 'fibrous',
    description: 'Swap multiple tokens for another token',
    schema: batchSwapSchema,
    execute: batchSwapTokens,
  });

  StarknetToolRegistry.push({
    name: 'route',
    plugins: 'fibrous',
    description: 'Get a specific route for swapping tokens',
    schema: routeSchema,
    execute: getRouteFibrous,
  });
};
