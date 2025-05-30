import { getOwnBalance } from '../../src/actions/getBalances.js';
import {
  createMockInvalidSnakAgent,
  createMockSnakAgent,
} from '../jest/setEnvVars.js';

const agent = createMockSnakAgent();
const wrong_agent = createMockInvalidSnakAgent();

describe('getOwnBlance', () => {
  describe('With perfect match inputs', () => {
    it('should return actual ETH balance', async () => {
      // Arrange
      const params = {
        symbol: 'ETH',
      };

      // Act
      const result = await getOwnBalance(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('success');
    });
    it('should return actual USDT balance', async () => {
      // Arrange
      const params = {
        symbol: 'USDT',
      };

      // Act
      const result = await getOwnBalance(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('success');
    });
  });
  describe('With wrong params', () => {
    it('should fail reason : invalid private_key', async () => {
      // Arrange
      const params = {
        symbol: 'ETH',
      };
      const invalidAgent = createMockInvalidSnakAgent();

      // Act
      const result = await getOwnBalance(wrong_agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });
    it('should fail reason : invalid symbol', async () => {
      // Arrange
      const params = {
        symbol: 'UNKNOWN',
      };

      // Act
      const result = await getOwnBalance(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });
  });
});
