import { getBalance } from '../../../../../plugins/erc721/src/actions/balanceOf';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const NFT_ADDRESS =
  '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Get NFT Balance', () => {
  describe('With perfect match inputs', () => {
    it('should return balance for valid address', async () => {
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        contractAddress: NFT_ADDRESS,
      };

      const result = await getBalance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        balance: expect.any(String),
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid account address', async () => {
      const params = {
        accountAddress: 'invalid_address',
        contractAddress: NFT_ADDRESS,
      };

      const result = await getBalance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid contract address', async () => {
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        contractAddress: 'invalid_address',
      };

      const result = await getBalance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
