import { transfer } from 'src/lib/agent/plugins/erc20/actions/transfer';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';
import { setupTestEnvironment } from 'test/utils/helpers';

const agent = createMockStarknetAgent();

setupTestEnvironment();

describe('Transfer token', () => {
  describe('With perfect match inputs', () => {
    it('should transfer 0.01 STRK to another address', async () => {
      const params = {
        recipientAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '0.01',
        assetSymbol: 'STRK',
      };

      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        amount: '0.01',
      });
    });
  });

  describe('With wrong input', () => {
    it('should fail with invalid recipient address', async () => {
      const params = {
        recipientAddress: 'invalid_address',
        amount: '0.2',
        assetSymbol: 'ETH',
      };

      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid amount format', async () => {
      const params = {
        recipientAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: 'WRONG_AMOUNT',
        assetSymbol: 'ETH',
      };

      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with unsupported token assetSymbol', async () => {
      const params = {
        recipientAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '0.2',
        assetSymbol: 'UNKNOWN',
      };

      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });

  describe('With good params but insufficient balance', () => {
    it('should fail due to insufficient balance', async () => {
      const params = {
        recipientAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '1000000',
        assetSymbol: 'ETH',
      };

      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
