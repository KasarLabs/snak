import { fetchQuotes, QuoteRequest } from '@avnu/avnu-sdk';
import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { TokenService } from './fetchTokens';
import { RouteSchemaType } from '../../../fibrous/src/schema';
import { RouteResult } from '../interfaces';

/**
 * Service class for fetching trading routes
 * @class RouteFetchService
 */
export class RouteFetchService {
  private tokenService: TokenService;

  /**
   * Creates an instance of RouteFetchService
   */
  constructor() {
    this.tokenService = new TokenService();
  }

  /**
   * Initializes the token service
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    await this.tokenService.initializeTokens();
  }

  /**
   * Fetches a trading route based on provided parameters
   * @param {RouteSchemaType} params - The route parameters
   * @param {StarknetAgentInterface} agent - The Starknet agent interface
   * @returns {Promise<RouteResult>} The route fetch result
   */
  async fetchRoute(
    params: RouteSchemaType,
    agent: StarknetAgentInterface
  ): Promise<RouteResult> {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;

    try {
      await this.initialize();

      const { sellToken, buyToken } = this.tokenService.validateTokenPair(
        params.sellTokenSymbol,
        params.buyTokenSymbol
      );

      const formattedAmount = BigInt(params.sellAmount.toString());

      const quoteParams: QuoteRequest = {
        sellTokenAddress: sellToken.address,
        buyTokenAddress: buyToken.address,
        sellAmount: formattedAmount,
        takerAddress: accountAddress,
        size: 1,
      };

      const quotes = await fetchQuotes(quoteParams);

      if (!quotes?.length) {
        return {
          status: 'failure',
          error: 'No routes available for this swap',
        };
      }

      const quote = quotes[0];
      const route = quote.routes?.[0];

      if (!route) {
        return {
          status: 'failure',
          error: 'No valid route found in quote',
        };
      }

      return {
        status: 'success',
        route,
        quote,
      };
    } catch (error) {
      console.error('Route fetching error:', error);
      return {
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Utility function to fetch a trading route
 * @param {StarknetAgentInterface} agent - The Starknet agent interface
 * @param {RouteSchemaType} params - The route parameters
 * @returns {Promise<RouteResult>} The route fetch result
 */
export const getRoute = async (
  agent: StarknetAgentInterface,
  params: RouteSchemaType
): Promise<RouteResult> => {
  try {
    const tokenService = new TokenService();
    await tokenService.initializeTokens();
    const routeService = new RouteFetchService();
    return routeService.fetchRoute(params, agent);
  } catch (error) {
    console.error('Route fetching error:', error);
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
