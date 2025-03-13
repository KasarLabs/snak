import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { LayerswapManager } from './layerswap-manager.js';

/**
 * Gets deposit actions for a swap
 *
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {Object} params - Parameters
 * @param {string} params.swap_id - ID of the swap
 * @param {string} params.source_address - Source address (required)
 * @returns {Promise<{status: string, deposit_actions?: any[], error?: any}>} Deposit actions
 */
export const layerswap_get_deposit_actions = async (
  agent: StarknetAgentInterface,
  params: { swap_id: string; source_address: string }
) => {
  try {
    // Initialize the LayerswapManager with the agent
    const layerswapManager = new LayerswapManager(agent);

    // Validate required parameters
    if (!params.swap_id) {
      throw new Error('swap_id is required');
    }

    if (!params.source_address) {
      throw new Error('source_address is required');
    }

    const depositActions = await layerswapManager.getDepositActions(
      params.swap_id,
      params.source_address
    );

    return {
      status: 'success',
      deposit_actions: depositActions,
    };
  } catch (error) {
    console.error('Error getting deposit actions:', error);
    return {
      status: 'error',
      error,
    };
  }
};
