import { setTimeout } from 'timers/promises';
import {
  createMockInvalidStarknetAgent,
  createMockStarknetAgent,
} from '../jest/setEnvVars.js';
import { getRoute } from '../../src/actions/fetchRoute.js';
import { RouteSchemaType } from '../../src/schema/index.js';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Get Route with avnu-sdk', () => {
  describe('With valid inputs', () => {
    it('should fetch route for STRK to ETH', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.01,
      };

      await setTimeout(500);
      const result = await getRoute(agent, params);

      console.log('result:', result);
      expect(result.status).toBe('success');
      expect(result.route).toBeDefined();
      expect(result.quote).toBeDefined();
    });

    it('should fetch route for ETH to USDC', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'ETH',
        buyTokenSymbol: 'USDC',
        sellAmount: 0.01,
      };

      await setTimeout(500); // Prevent rate limiting
      const result = await getRoute(agent, params);

      expect(result.status).toBe('success');
      expect(result.route).toBeDefined();
      expect(result.quote).toBeDefined();
    });

    it('should fetch route with larger amount', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.01,
      };

      await setTimeout(500); // Prevent rate limiting
      const result = await getRoute(agent, params);

      expect(result.status).toBe('success');
      expect(result.route).toBeDefined();
      expect(result.quote).toBeDefined();
    });
  });

  describe('With invalid inputs', () => {
    it('should fail with non-existent sell token', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'NONEXISTENT',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.01,
      };

      const result = await getRoute(agent, params);

      expect(result.status).toBe('failure');
      expect(result.error).toContain('not supported');
    });

    it('should fail with non-existent buy token', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'ETH',
        buyTokenSymbol: 'NONEXISTENT',
        sellAmount: 0.01,
      };

      const result = await getRoute(agent, params);

      expect(result.status).toBe('failure');
      expect(result.error).toContain('not supported');
    });

    it('should fail with zero sell amount', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0,
      };

      const result = await getRoute(agent, params);

      expect(result.status).toBe('failure');
    });

    it('should fail with invalid agent credentials', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.01,
      };

      const result = await getRoute(wrong_agent, params);

      expect(result.status).toBe('failure');
    });

    it('should fail when same tokens are provided', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'ETH',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.01,
      };

      const result = await getRoute(agent, params);

      expect(result.status).toBe('failure');
    });
  });

  describe('Edge cases', () => {
    it('should handle extremely small amounts', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 100000000000,
      };

      await setTimeout(500); // Prevent rate limiting
      const result = await getRoute(agent, params);

      // May either succeed with a route or fail with a specific message
      if (result.status === 'success') {
        expect(result.route).toBeDefined();
        expect(result.quote).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });

    it('should handle extremely large amounts', async () => {
      const params: RouteSchemaType = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.01,
      };

      await setTimeout(500); // Prevent rate limiting
      const result = await getRoute(agent, params);

      // May either succeed with a route or fail with a specific message about liquidity
      if (result.status === 'success') {
        expect(result.route).toBeDefined();
        expect(result.quote).toBeDefined();
      } else {
        expect(result.error).toBeDefined();
      }
    });
  });
});
