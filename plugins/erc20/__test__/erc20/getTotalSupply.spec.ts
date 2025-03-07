import { getTotalSupply } from '../../src/actions/getTotalSupply.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';
import { setupTestEnvironment } from '../utils/helper.js';

const agent = createMockStarknetAgent();

setupTestEnvironment();

describe('Get total supply', () => {
  describe('With perfect match inputs', () => {
    it('should get total supply for ETH', async () => {
      const params = {
        assetSymbol: 'ETH',
      }

      const result = await getTotalSupply(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        totalSupply: expect.any(String),
      });
    });
  });

  describe('With wrong input', () => {
    it('should fail with invalid token address', async () => {
      const params = {
        assetSymbol: 'invalidaddress',
      }

      const result = await getTotalSupply(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
