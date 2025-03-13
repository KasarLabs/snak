import { StarknetToolRegistry } from '@starknet-agent-kit/agents';

import {
  // getAvailableRoutesSchema,
  getSwapQuoteSchema,
  createSwapSchema,
  getSwapStatusSchema,
  executeBridgeSchema,
} from '../schema/index.js';
import { layerswap_create_swap } from '../actions/create-swap.js';
import { layerswap_execute_bridge } from '../actions/execute-bridge.js';
import { layerswap_get_quote } from '../actions/get-quote.js';
import { layerswap_get_swap_status } from '../actions/get-swap-status.js';

/**
 * Registers all Layerswap-related tools with the Starknet Tool Registry
 */
export const registerLayerswapTools = () => {
  // Tool to get available bridge routes
  // StarknetToolRegistry.registerTool({
  //   name: 'layerswap_get_available_routes',
  //   plugins: 'layerswap',
  //   description: 'Get available routes for bridging assets between networks',
  //   schema: getAvailableRoutesSchema,
  //   execute: layerswap_get_available_routes,
  // });

  // Tool to get a bridge quote
  StarknetToolRegistry.registerTool({
    name: 'layerswap_get_quote',
    plugins: 'layerswap',
    description: 'Get a quote for bridging assets between networks',
    schema: getSwapQuoteSchema,
    execute: layerswap_get_quote,
  });

  // Tool to create a new swap
  StarknetToolRegistry.registerTool({
    name: 'layerswap_create_swap',
    plugins: 'layerswap',
    description: 'Create a new swap for bridging assets',
    schema: createSwapSchema,
    execute: layerswap_create_swap,
  });

  // Tool to get swap status
  StarknetToolRegistry.registerTool({
    name: 'layerswap_get_swap_status',
    plugins: 'layerswap',
    description: 'Get the current status of a swap',
    schema: getSwapStatusSchema,
    execute: layerswap_get_swap_status,
  });

  // Tool to execute a complete bridge operation
  StarknetToolRegistry.registerTool({
    name: 'layerswap_execute_bridge',
    plugins: 'layerswap',
    description:
      'Execute a complete bridge operation from one network to another',
    schema: executeBridgeSchema,
    execute: layerswap_execute_bridge,
  });
};
