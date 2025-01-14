import { fetchQuotes, QuoteRequest, Quote, Route } from '@avnu/avnu-sdk';
import { TokenService } from './tokenService';
import { z } from 'zod';

export const routeSchema = z.object({
  sellTokenSymbol: z
    .string()
    .describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
  buyTokenSymbol: z
    .string()
    .describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
  sellAmount: z.number().positive().describe('Amount of tokens to sell'),
});

type RouteSchemaType = z.infer<typeof routeSchema>;

interface RouteResult {
  status: 'success' | 'failure';
  route?: Route;
  quote?: Quote;
  error?: string;
}

export class RouteFetchService {
  private tokenService: TokenService;

  constructor() {
    this.tokenService = new TokenService();
  }

  async initialize(): Promise<void> {
    await this.tokenService.initializeTokens();
  }

  async fetchRoute(params: RouteSchemaType): Promise<RouteResult> {
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
        takerAddress: process.env.PUBLIC_ADDRESS!,
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

export const getRoute = async (
  params: RouteSchemaType
): Promise<RouteResult> => {
  const routeService = new RouteFetchService();
  return routeService.fetchRoute(params);
};
