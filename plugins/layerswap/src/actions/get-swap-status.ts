import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { GetSwapStatusParams } from '../schema/index.js';
import { LayerswapManager } from './layerswap-manager.js';

/**
 * Gets the status of a swap
 *
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {GetSwapStatusParams} params - Parameters with swap ID
 * @returns {Promise<{status: string, swap?: any, error?: any}>} Swap status
 */
export const layerswap_get_swap_status = async (
  agent: StarknetAgentInterface,
  params: GetSwapStatusParams
) => {
  try {
    // Initialize the LayerswapManager with the agent
    const layerswapManager = new LayerswapManager(agent);

    const swap = await layerswapManager.getSwapStatus(params.swap_id);

    return {
      status: 'success',
      swap,
    };
  } catch (error) {
    console.error('Error getting swap status:', error);
    return {
      status: 'error',
      error,
    };
  }
};
