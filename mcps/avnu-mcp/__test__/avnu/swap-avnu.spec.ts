import { setTimeout } from 'timers/promises';
import {
  createMockInvalidSnakAgent,
  createMockSnakAgent,
} from '../jest/setEnvVars.js';
import { swapTokens } from '../../src/actions/swap.js';
import { SwapParams } from '../../src/types/index.js';

const agent = createMockSnakAgent();
const wrong_agent = createMockInvalidSnakAgent();

describe('Swap Token with avnu-sdk', () => {
  describe('With perfect match inputs', () => {
    it('should swap token 0.001 ETH to STRK', async () => {
      const params: SwapParams = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.0001,
      };
      await setTimeout(500);

      const result = await swapTokens(agent, params);
      const parsed = JSON.parse(result);

      await setTimeout(500);

      expect(parsed).toMatchObject({
        status: 'success',
        sellAmount: 0.0001,
        sellToken: 'STRK',
        buyToken: 'ETH',
      });
    });
    it('should swap token 0.0012 STRK to ETH', async () => {
      const params: SwapParams = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.0012,
      };

      const result = await swapTokens(agent, params);
      const parsed = JSON.parse(result);
      expect(parsed).toMatchObject({
        status: 'success',
        sellAmount: 0.0012,
        sellToken: 'STRK',
        buyToken: 'ETH',
      });
    });
  });
  describe('With wrong input', () => {
    it('should fail reason : negative sell amount', async () => {
      const params: SwapParams = {
        sellTokenSymbol: 'ETH',
        buyTokenSymbol: 'STRK',
        sellAmount: -12,
      };

      const result = await swapTokens(agent, params);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('failure');
    });
    it('should fail reason : invalid sell Token Symbol', async () => {
      const params: SwapParams = {
        sellTokenSymbol: 'NOTSTRK',
        buyTokenSymbol: 'USDT',
        sellAmount: 15,
      };

      const result = await swapTokens(agent, params);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('failure');
      expect(parsed.error).toBe(
        `Sell token ${params.sellTokenSymbol} not supported`
      );
    });
    it('should fail reason : invalid buy Token Symbol', async () => {
      const params: SwapParams = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'NOTUSDT',
        sellAmount: 0.0015,
      };

      const result = await swapTokens(agent, params);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('failure');
      expect(parsed.error).toBe(
        `Buy token ${params.buyTokenSymbol} not supported`
      );
    });
    it('should fail reason : invalid reason wrong private key', async () => {
      const params: SwapParams = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'USDC',
        sellAmount: 300,
      };

      const result = await swapTokens(wrong_agent, params);
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('failure');
    });
  });
});
