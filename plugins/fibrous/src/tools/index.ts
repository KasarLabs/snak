import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { swapSchema } from '../schema';
import { swapTokensFibrous } from '../actions/swap';
import { batchSwapSchema, routeSchema } from '../schema';
import { batchSwapTokens } from '../actions/batchSwap';
import { getRouteFibrous } from '../actions/fetchRoute';

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
