import { LaunchOnEkuboParams } from '../schema/';
import { FACTORY_ABI } from '../abis/unruggableFactory';
import { FACTORY_ADDRESS } from '../constants';
import { Contract } from 'starknet';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';

/**
 * Launches a memecoin on the Ekubo DEX with concentrated liquidity.
 *
 * This function initializes a new trading pool on Ekubo for the memecoin,
 * sets up the initial liquidity, and configures trading parameters.
 *
 * @param {LaunchOnEkuboParams} params - Combined launch and pool parameters
 * @returns {Promise<string>} JSON string containing either success or error response
 *
 * @example
 * ```typescript
 * const result = await launchOnEkubo({
 *   launchParams: {
 *     memecoinAddress: "0x123...",
 *     transferRestrictionDelay: 86400, // 24 hours
 *     maxPercentageBuyLaunch: 5, // 5% max buy
 *     quoteAddress: "0x456...", // ETH address
 *     initialHolders: ["0x789..."],
 *     initialHoldersAmounts: ["1000000000000000000"] // 1 token
 *   },
 *   ekuboParams: {
 *     fee: "3000", // 0.3% fee
 *     tickSpacing: "60",
 *     startingPrice: {
 *       mag: "1000000000000000000", // 1.0 price
 *       sign: true
 *     },
 *     bound: "500000"
 *   }
 * });
 *
 * const response = JSON.parse(result);
 * if (response.status === 'success') {
 *   console.log('Token ID:', response.response.token_id);
 *   console.log('LP Info:', response.response.lp_info);
 * } else {
 *   console.error('Launch failed:', response.error);
 * }
 * ```
 *
 * @throws Will throw an error if:
 * - Invalid addresses are provided
 * - Initial holders and amounts arrays don't match in length
 * - Fee is outside valid range (1-10000 basis points)
 * - Price bounds are invalid
 * - Contract interaction fails
 *
 * @note
 * - Transfer restriction delay helps prevent pump and dumps
 * - Max percentage buy prevents whale manipulation at launch
 * - Tick spacing affects price granularity and gas costs
 * - Bound parameter sets the concentrated liquidity range
 */
export const launchOnEkubo = async (
  agent: StarknetAgentInterface,
  params: LaunchOnEkuboParams
) => {
  try {
    const provider = agent.getProvider();
    const accountCredentials = agent.getAccountCredentials();

    const contract = new Contract(FACTORY_ABI, FACTORY_ADDRESS, provider);

    const launchParams = params.launchParams;
    const ekuboParams = params.ekuboParams;

    const paramsToSend = {
      memecoin_address: launchParams.memecoinAddress,
      transfer_restriction_delay: launchParams.transferRestrictionDelay,
      max_percentage_buy_launch: launchParams.maxPercentageBuyLaunch,
      quote_address: launchParams.quoteAddress,
      initial_holders: launchParams.initialHolders,
      initial_holders_amounts: launchParams.initialHoldersAmounts,
    };

    const ekuboPoolParams = {
      fee: ekuboParams.fee,
      tick_spacing: ekuboParams.tickSpacing,
      starting_price: {
        mag: ekuboParams.startingPrice.mag,
        sign: ekuboParams.startingPrice.sign,
      },
      bound: ekuboParams.bound,
    };

    const response = await contract.launch_on_ekubo(
      paramsToSend,
      ekuboPoolParams
    );

    return JSON.stringify({
      status: 'success',
      response,
    });
  } catch (error) {
    console.error('Error launching on Ekubo:', error);
    return JSON.stringify({
      status: 'failed',
      error: error.message,
    });
  }
};
