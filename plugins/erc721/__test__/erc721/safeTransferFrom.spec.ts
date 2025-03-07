import { getOwner } from '../../src/actions/ownerOf.js';
import { safeTransferFrom } from '../../src/actions/safeTransferFrom.js';
import {
  createMockStarknetAgent,
  createMockInvalidStarknetAgent,
} from '../jest/setEnvVars.js';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();
const NFT_ADDRESS =
  '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Safe Transfer From', () => {
  describe('With perfect match inputs', () => {
    it('should safely transfer token between addresses', async () => {
      const params = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '14',
        contractAddress: NFT_ADDRESS,
        data: ['0x0'],
      };

      const result = await safeTransferFrom(agent, params);
      const parsed = JSON.parse(result);

      console.log(parsed);
      expect(parsed).toMatchObject({
        status: 'success',
        tokenId: '14',
        from: process.env.STARKNET_PUBLIC_ADDRESS as String,
        to: process.env.STARKNET_PUBLIC_ADDRESS_2 as String,
        transactionHash: expect.any(String),
      });
    });

    it('should safely transfer token without optional data', async () => {
      const params = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '15',
        contractAddress: NFT_ADDRESS,
      };

      const result = await safeTransferFrom(agent, params);
      const parsed = JSON.parse(result);
      console.log(parsed);

      expect(parsed).toMatchObject({
        status: 'success',
        tokenId: '15',
        from: expect.any(String),
        to: expect.any(String),
        transactionHash: expect.any(String),
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid addresses', async () => {
      const params = {
        fromAddress: 'invalid_address',
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '5',
        contractAddress: NFT_ADDRESS,
      };

      const result = await safeTransferFrom(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
      });
    });

    it('should fail with invalid agent', async () => {
      const params = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '5',
        contractAddress: NFT_ADDRESS,
      };

      const result = await safeTransferFrom(wrong_agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
