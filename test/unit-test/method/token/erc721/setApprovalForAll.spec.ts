import { setApprovalForAll } from '../../../../../plugins/erc721/src/actions/setApprovalForAll';
import { isApprovedForAll } from '../../../../../plugins/erc721/src/actions/isApprovedForAll';
import {
  createMockStarknetAgent,
  createMockInvalidStarknetAgent,
} from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();
const NFT_ADDRESS =
  '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Set Approval For All', () => {
  describe('With perfect match inputs', () => {
    it('should approve operator for all tokens', async () => {
      let params = {
        operatorAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        approved: true,
        contractAddress: NFT_ADDRESS,
      };

      let result = await setApprovalForAll(agent, params);
      let parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        operator: expect.any(String),
        approved: true,
        transactionHash: expect.any(String),
      });

      let params2 = {
        ownerAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        operatorAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        contractAddress: NFT_ADDRESS,
      };

      result = await isApprovedForAll(agent, params2);
      parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        isApproved: true,
      });
    });

    it('should revoke approval for operator', async () => {
      const params = {
        operatorAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        approved: false,
        contractAddress: NFT_ADDRESS,
      };

      let result = await setApprovalForAll(agent, params);
      let parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        operator: expect.any(String),
        approved: false,
        transactionHash: expect.any(String),
      });

      let params2 = {
        ownerAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        operatorAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        contractAddress: NFT_ADDRESS,
      };

      result = await isApprovedForAll(agent, params2);
      parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        isApproved: false,
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid operator address', async () => {
      const params = {
        operatorAddress: 'invalid_address',
        approved: true,
        contractAddress: NFT_ADDRESS,
      };

      const result = await setApprovalForAll(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
      });
    });

    it('should fail with invalid agent', async () => {
      const params = {
        operatorAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        approved: true,
        contractAddress: NFT_ADDRESS,
      };

      const result = await setApprovalForAll(wrong_agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail without approval status', async () => {
      const params = {
        operatorAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        contractAddress: NFT_ADDRESS,
      } as any;

      const result = await setApprovalForAll(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
      });
    });
  });
});
