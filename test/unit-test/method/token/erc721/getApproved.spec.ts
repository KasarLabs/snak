import { getApproved } from '../../../../../plugins/erc721/src/actions/getApproved';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const NFT_ADDRESS =
  '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Get Approved Address for Token', () => {
  describe('With perfect match inputs', () => {
    it('should return approved address for valid token', async () => {
      const params = {
        tokenId: '55',
        contractAddress: NFT_ADDRESS,
      };

      const result = await getApproved(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        approved: '0',
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid token ID', async () => {
      const params = {
        tokenId: 'invalid_id',
        contractAddress:
          '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
      };

      const result = await getApproved(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
