import { setTimeout } from 'timers/promises';
import {
  createMockInvalidStarknetAgent,
  createMockStarknetAgent,
} from '../jest/setEnvVars';
import { swapTokens } from '../../src/actions/swap';
import { SwapParams } from '../../src/types/index';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Swap Token with avnu-sdk', () => {
  describe('With perfect match inputs', () => {
    it('should swap token 0.001 ETH to STRK', async () => {
      // Arrange
      const params: SwapParams = {
        sellTokenSymbol: 'STRK',
        buyTokenSymbol: 'ETH',
        sellAmount: 0.0001,
      };
      // Act
      await setTimeout(500);

      const result = await swapTokens(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      await setTimeout(500);
      console.log('parsed:', parsed);
      expect(parsed).toMatchObject({
        status: 'success',
        sellAmount: 0.0001,
        sellToken: 'STRK',
        buyToken: 'ETH',
      });
    });
  //   it('should swap token 0.0012 STRK to ETH', async () => {
  //     // Arrange
  //     const params: SwapParams = {
  //       sellTokenSymbol: 'STRK',
  //       buyTokenSymbol: 'ETH',
  //       sellAmount: 0.0012,
  //     };
  //     // Act
  //     const result = await swapTokens(agent, params);
  //     const parsed = JSON.parse(result);
  //     // Assert
  //     expect(parsed).toMatchObject({
  //       status: 'success',
  //       sellAmount: 0.0012,
  //       sellToken: 'STRK',
  //       buyToken: 'ETH',
  //     });
  //   });
  // });
  // describe('With wrong input', () => {
  //   it('should fail reason : negative sell amount', async () => {
  //     // Arrange
  //     const params: SwapParams = {
  //       sellTokenSymbol: 'ETH',
  //       buyTokenSymbol: 'STRK',
  //       sellAmount: -12,
  //     };
  //     // Act
  //     const result = await swapTokens(agent, params);
  //     const parsed = JSON.parse(result);
  //     // Assert
  //     expect(parsed.status).toBe('failure');
  //   });
  //   it('should fail reason : invalid sell Token Symbol', async () => {
  //     // Arrange
  //     const params: SwapParams = {
  //       sellTokenSymbol: 'NOTSTRK',
  //       buyTokenSymbol: 'USDT',
  //       sellAmount: 15,
  //     };
  //     // Act
  //     const result = await swapTokens(agent, params);
  //     const parsed = JSON.parse(result);
  //     // Assert
  //     expect(parsed.status).toBe('failure');
  //     expect(parsed.error).toBe(
  //       `Sell token ${params.sellTokenSymbol} not supported`
  //     );
  //   });
  //   it('should fail reason : invalid buy Token Symbol', async () => {
  //     // Arrange
  //     const params: SwapParams = {
  //       sellTokenSymbol: 'STRK',
  //       buyTokenSymbol: 'NOTUSDT',
  //       sellAmount: 0.0015,
  //     };
  //     // Act
  //     const result = await swapTokens(agent, params);
  //     const parsed = JSON.parse(result);
  //     // Assert
  //     expect(parsed.status).toBe('failure');
  //     expect(parsed.error).toBe(
  //       `Buy token ${params.buyTokenSymbol} not supported`
  //     );
  //   });
  //   it('should fail reason : invalid reason wrong private key', async () => {
  //     // Arrange
  //     const params: SwapParams = {
  //       sellTokenSymbol: 'STRK',
  //       buyTokenSymbol: 'USDC',
  //       sellAmount: 300,
  //     };
  //     // Act
  //     const result = await swapTokens(wrong_agent, params);
  //     const parsed = JSON.parse(result);
  //     // Assert
  //     expect(parsed.status).toBe('failure');
  //   });
  });
});
