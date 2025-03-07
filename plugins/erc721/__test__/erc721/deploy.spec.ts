import { deployERC721Contract } from '../../src/actions/deployERC721.js';
import {
  createMockStarknetAgent,
  createMockInvalidStarknetAgent,
} from '../jest/setEnvVars.js';

const agent = createMockStarknetAgent();

describe('Deploy NFT Contract', () => {
  describe('With perfect match inputs', () => {
    it('should successfully deploy contract', async () => {
      const params = {
        name: 'MyNFT',
        symbol: 'NFT',
        baseUri: 'test',
        totalSupply: '10',
      };

      const result = await deployERC721Contract(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        contractAddress: expect.any(String),
      });
    });
  });
});
