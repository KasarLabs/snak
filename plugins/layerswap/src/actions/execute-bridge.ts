import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { ExecuteBridgeParams } from '../schema/index.js';
import {
  LayerswapConstant,
  SwapStatus,
  SwapInput,
  SwapResponseData,
  SwapResponse,
} from '../types/index.js';
import { LayerswapManager } from './layerswap-manager.js';

/**
 * Executes a complete bridge operation
 *
 * @param {StarknetAgentInterface} agent - Starknet agent
 * @param {ExecuteBridgeParams} params - Bridge parameters
 * @returns {Promise<{status: string, result?: any, error?: any}>} Bridge result
 */
export const layerswap_execute_bridge = async (
  agent: StarknetAgentInterface,
  params: ExecuteBridgeParams
) => {
  try {
    // Initialize the LayerswapManager with the agent
    const layerswapManager = new LayerswapManager(agent);

    // Step 1: Check route limits
    const limits = await layerswapManager.getLimits(
      params.source_network,
      params.source_token,
      params.destination_network,
      params.destination_token,
      params.refuel
    );

    console.log('limits:', limits);

    // Validate amount
    if (
      params.amount < limits.min_amount ||
      params.amount > limits.max_amount
    ) {
      throw new Error(
        `Amount must be between ${limits.min_amount} and ${limits.max_amount} ${params.source_token}`
      );
    }

    // Step 2: Get quote
    const quote = await layerswapManager.getQuote({
      source_network: params.source_network,
      source_token: params.source_token,
      destination_network: params.destination_network,
      destination_token: params.destination_token,
      amount: params.amount,
      refuel: params.refuel,
    });

    console.log('quote:', quote);

    // Step 3: Create swap
    const referenceId = params.reference_id || `bridge-${Date.now()}`;
    console.log('referenceId:', referenceId);

    // Create minimal swap payload
    const swapInput: SwapInput = {
      source_network: params.source_network,
      source_token: params.source_token,
      destination_network: params.destination_network,
      destination_token: params.destination_token,
      destination_address: params.destination_address,
      amount: params.amount,
    };

    console.log('swapInput:', swapInput);

    const swapResponse = await layerswapManager.createSwap(swapInput);
    console.log('swap created:', swapResponse);

    // Step 4: Get deposit actions
    const depositActions = await layerswapManager.getDepositActions(
      swapResponse.data.swap.id,
      params.source_address
    );

    if (!depositActions || depositActions.length === 0) {
      throw new Error('No deposit actions received from Layerswap');
    }

    const depositAction = depositActions[0];

    // Step 5: Send transaction on Starknet
    let txHash;
    // For token transfers using the call_data from API
    if (depositAction.call_data) {
      const calldata = JSON.parse(depositAction.call_data);

      if (calldata && calldata.length > 0) {
        txHash = await layerswapManager.executeMultiCall(calldata);

        console.log('Transaction sent:', txHash);
      } else {
        throw new Error('Invalid call data format from Layerswap');
      }
    }
    // Fall back to ETH transfer if needed
    else if (params.source_token === 'ETH') {
      txHash = await layerswapManager.executeEthTransfer(
        depositAction.token.contract,
        depositAction.to_address,
        params.amount
      );
      console.log('ETH transaction sent:', txHash);
    } else {
      throw new Error(`Support for ${params.source_token} not yet implemented`);
    }

    // Step 6: Poll for swap status
    const maxPollAttempts =
      params.max_poll_attempts || LayerswapConstant.DEFAULT_MAX_POLL_ATTEMPTS;
    const pollIntervalMs =
      params.poll_interval_ms || LayerswapConstant.DEFAULT_POLL_INTERVAL_MS;

    let pollAttempt = 0;
    let swapCompleted = false;
    let finalSwap: SwapResponseData | null = null;

    while (pollAttempt < maxPollAttempts && !swapCompleted) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

      const swapStatus = await layerswapManager.getSwapStatus(
        swapResponse.data.swap.id
      );

      if (swapStatus.status === SwapStatus.COMPLETED) {
        swapCompleted = true;
        finalSwap = swapStatus;
      } else if (swapStatus.status === SwapStatus.FAILED) {
        throw new Error(`Swap failed: ${JSON.stringify(swapStatus)}`);
      } else if (
        swapStatus.status === SwapStatus.CANCELLED ||
        swapStatus.status === SwapStatus.EXPIRED
      ) {
        throw new Error(
          `Swap ${swapStatus.status}: ${JSON.stringify(swapStatus)}`
        );
      }

      pollAttempt++;
    }

    if (!swapCompleted) {
      return {
        status: 'pending',
        result: {
          swapId: swapResponse.data.swap.id,
          sourceTransaction: txHash?.transaction_hash,
          referenceId,
          message: 'Maximum poll attempts reached. Check swap status manually.',
        },
      };
    }

    return {
      status: 'success',
      result: {
        swapId: swapResponse.data.swap.id,
        sourceTransaction: txHash?.transaction_hash,
        destinationTransaction: finalSwap?.transactions?.[0]?.transaction_id,
        status: finalSwap?.status,
        referenceId,
        amount: params.amount,
        destinationAmount: quote.receive_amount,
      },
    };
  } catch (error) {
    console.error('Error during bridge execution:', error);
    return {
      status: 'error',
      error,
    };
  }
};
