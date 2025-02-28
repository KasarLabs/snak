import { StarknetAgentInterface } from '@starknet-agent-kit/agents';
import { TokenService } from './fetchTokens';
import { Router as FibrousRouter, RouteResponse } from 'fibrous-router-sdk';
import { BigNumber } from '@ethersproject/bignumber';
import { RouteSchemaType } from '../schema';

interface RouteResult {
  status: 'success' | 'failure';
  route?: RouteResponse | null;
  error?: string;
}

export class RouteFetchService {
  private tokenService: TokenService;
  private router: FibrousRouter;

  constructor() {
    this.tokenService = new TokenService();
    this.router = new FibrousRouter();
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

      const route = await this.router.getBestRoute(
        BigNumber.from(formattedAmount.toString()),
        sellToken.address,
        buyToken.address,
        'starknet'
      );

      if (!route?.success) {
        return {
          status: 'failure',
          error: 'No routes available for this swap',
        };
      }

      if (!route) {
        return {
          status: 'failure',
          error: 'No valid route found in quote',
        };
      }

      return {
        status: 'success',
        route,
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

export const getRouteFibrous = async (
  agent: StarknetAgentInterface,
  params: RouteSchemaType
): Promise<RouteResult> => {
  try {
    const tokenService = new TokenService();
    await tokenService.initializeTokens();
    const routeService = new RouteFetchService();
    return routeService.fetchRoute(params);
  } catch (error) {
    console.error('Route fetching error:', error);
    return {
      status: 'failure',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
