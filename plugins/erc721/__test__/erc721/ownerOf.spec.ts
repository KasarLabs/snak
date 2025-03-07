import { getOwner } from '../../src/actions/ownerOf.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';

const agent = createMockStarknetAgent();
const NFT_ADDRESS = '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Get Owner of Token', () => {
  describe('With perfect match inputs', () => {
    it('should return owner address for a valid token', async () => {
      const params = {
        tokenId: '40',
        contractAddress: NFT_ADDRESS
      };

      const result = await getOwner(agent, params);
      const parsed = JSON.parse(result);

      const owner = agent.getAccountCredentials().accountPublicKey.toString();
      expect(parsed).toMatchObject({
        status: 'success',
        owner: owner
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid token ID', async () => {
      const params = {
        tokenId: 'invalid_id',
        contractAddress: NFT_ADDRESS
      };

      const result = await getOwner(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure'
      });
    });

    it('should fail with invalid contract address', async () => {
      const params = {
        tokenId: '1',
        contractAddress: 'invalid_address'
      };

      const result = await getOwner(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure'
      });
    });
  });
});