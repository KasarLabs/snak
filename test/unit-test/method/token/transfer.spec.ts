import { transfer } from '../../../../server/agent/plugins/core/token/actions/transfer';
import * as C from '../../../utils/constant';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';
import { setupTestEnvironment } from 'test/utils/helpers';

const agent = createMockStarknetAgent();

setupTestEnvironment();

describe('Transfer token', () => {
  describe('With perfect match inputs', () => {
    it('should transfer 0.5 ETH to another address', async () => {
      // Arrange
      const params = {
        recipient_address: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '0.5',
        symbol: 'ETH',
      };

      // Act
      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed).toMatchObject({
        status: 'success',
        amount: '0.5',
        symbol: 'ETH',
        recipients_address: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
      });
    });
  });
  describe('With wrong input', () => {
    it('should fail reason : wrong recipient_address', async () => {
      // Arrange
      const params = {
        recipient_address: C.invalid_private_key,
        amount: '0.2',
        symbol: 'USDT',
      };

      // Act
      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
    it('should fail reason : wrong amount', async () => {
      // Arrange
      const params = {
        recipient_address: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: 'WRONG_AMOUNT',
        symbol: 'USDT',
      };

      // Act
      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
    it('should fail reason : wrong symbol', async () => {
      // Arrange
      const params = {
        recipient_address: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '0.2',
        symbol: 'UNKNOWN',
      };

      // Act
      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
  describe('With good params but wrong capacity', () => {
    it('should fail reason : not_enough_balance', async () => {
      // Arrange
      const params = {
        recipient_address: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '1000000',
        symbol: 'STRK',
      };

      // Act
      const result = await transfer(agent, params);
      const parsed = JSON.parse(result);
      console.log(parsed);
      // Assert
      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
