import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

import { CreateSwapParams } from '../schema/index.js';
import { SwapInput } from '../types/index.js';
import { LayerswapManager } from './layerswap-manager.js';

/**
 * Creates a new swap
 *
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {CreateSwapParams} params - Swap parameters
 * @returns {Promise<{status: string, swap?: SwapResponseData, error?: any}>} Created swap
 */
export const layerswap_create_swap = async (
  agent: StarknetAgentInterface,
  params: CreateSwapParams
) => {
  try {
    // Validate required parameters
    if (!params.destination_address) {
      throw new Error('destination_address is required');
    }

    // Initialize the LayerswapManager with the agent
    const layerswapManager = new LayerswapManager(agent);

    // Create minimal swap input to match API expectations
    const swapInput: SwapInput = {
      source_network: params.source_network,
      source_token: params.source_token,
      destination_network: params.destination_network,
      destination_token: params.destination_token,
      destination_address: params.destination_address,
      amount: params.amount,
    };

    // Add optional parameters if needed
    if (params.refuel !== undefined) {
      swapInput.refuel = params.refuel;
    }

    const swap = await layerswapManager.createSwap(swapInput);

    return {
      status: 'success',
      swap,
    };
  } catch (error) {
    console.error('Error creating swap:', error);
    return {
      status: 'error',
      error,
    };
  }
};
