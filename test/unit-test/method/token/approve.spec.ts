import { approve } from 'src/lib/agent/plugins/erc20/actions/approve';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';
import { setupTestEnvironment } from 'test/utils/helpers';

const agent = createMockStarknetAgent();

setupTestEnvironment();

describe('Approve token spending', () => {
  describe('With perfect match inputs', () => {
    it('should approve spender to spend tokens with symbol token sent', async () => {
      const params = {
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '1.0',
        assetSymbol: 'STRK' as string,
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
      });
    });
  });

  it('should approve spender to spend tokens with address token sent', async () => {
    const params = {
      spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
      amount: '1.0',
      assetAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d' as string,
    };

    const result = await approve(agent, params);
    const parsed = JSON.parse(result);

    expect(parsed).toMatchObject({
      status: 'success',
      transactionHash: expect.any(String),
      symbol: 'STRK',
    });
  });
});
  describe('With wrong input', () => {
    it('should fail with invalid token address', async () => {
      const params = {
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '1.0',
        assetAddress: '0x49dddf03a0f0a9e70e28dcd74cbf44931174dbe3cc4b2ffdddddddddddddddd' as string,
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
    
    it('should fail with invalid symbol address even if good token address', async () => {
      const params = {
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '1.0',
        assetSymbol: 'WRONG_SYMBOL' as string,
        assetAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d' as string,
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid spender address', async () => {
      const params = {
        spenderAddress: 'invalid_address',
        amount: '1.0',
        assetSymbol: 'ETH' as string,
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid amount format', async () => {
      const params = {
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: 'WRONG_AMOUNT',
        assetSymbol: 'ETH' as string,
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid token assetSymbol', async () => {
      const params = {
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '1.0',
        assetSymbol: 'PPPPP',
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
});
