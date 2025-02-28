import { transferFrom } from 'src/lib/agent/plugins/erc721/actions/transferFrom';
import { createMockStarknetAgent, createMockInvalidStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();
const NFT_ADDRESS = '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Transfer From', () => {
  describe('With perfect match inputs', () => {
    it('should transfer token between addresses', async () => {
      const params = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '23',
        contractAddress: NFT_ADDRESS
      };

      const result = await transferFrom(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        tokenId: '23',
        from: expect.any(String),
        to: expect.any(String),
        transactionHash: expect.any(String)
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid from address', async () => {
      const params = {
        fromAddress: 'invalid_address',
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '24',
        contractAddress: NFT_ADDRESS
      };

      const result = await transferFrom(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String)
      });
    });

    it('should fail with invalid tokenId', async () => {
      const params = {
        fromAddress: 'invalid_address',
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '24',
        contractAddress: NFT_ADDRESS
      };

      const result = await transferFrom(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String)
      });
    });

    it('should fail with invalid agent', async () => {
      const params = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '24',
        contractAddress: NFT_ADDRESS
      };

      const result = await transferFrom(wrong_agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure'
      });
    });
  });
});
