import { getAddress } from '../../../../../server/agent/plugins/core/account/actions/getAddress';
import {
  createMockInvalidStarknetAgent,
  createMockStarknetAgent,
} from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('getAddress', () => {
  describe('With perfect match inputs', () => {
    it('returns success with account address', async () => {
      // Arrange
      // Act

      const result = await getAddress(agent);
      const parsed = JSON.parse(result);
      // Assert
      expect(parsed.status).toBe('success');
    });
  });
  describe('With missing inputs', () => {
    it('returns failure reason : invalid account_address', async () => {
      // Arrange
      const mockAddress = '';

      process.env = {
        STARKNET_PUBLIC_ADDRESS: mockAddress,
      } as NodeJS.ProcessEnv;

      // Act

      const result = await getAddress(wrong_agent);
      const parsed = JSON.parse(result);
      // Assert
      expect(parsed.status).toBe('failure');
    });
  });
});
