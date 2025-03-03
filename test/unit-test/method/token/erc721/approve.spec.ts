import { approve } from '../../../../../plugins/erc721/src/actions/approve';
import { getApproved } from '../../../../../plugins/erc721/src/actions/getApproved';
import { validateAndParseAddress } from 'starknet';
import {
  createMockStarknetAgent,
  createMockInvalidStarknetAgent,
} from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();
const NFT_ADDRESS =
  '0x00ab5ac5f575da7abb70657a3ce4ef8cc4064b365d7d998c09d1e007c1e12921';

describe('Approve Token', () => {
  describe('With perfect match inputs', () => {
    it('should approve address for token and verify approval', async () => {
      const approvedAddress = process.env.STARKNET_PUBLIC_ADDRESS_2 as string;
      const params = {
        approvedAddress,
        tokenId: '30',
        contractAddress: NFT_ADDRESS,
      };

      const approveResult = await approve(agent, params);
      const parsedApprove = JSON.parse(approveResult);

      expect(parsedApprove).toMatchObject({
        status: 'success',
        tokenId: '30',
        approved: true,
        transactionHash: expect.any(String),
      });

      const getApprovedParams = {
        tokenId: '30',
        contractAddress: NFT_ADDRESS,
      };
      const getApprovedResult = await getApproved(agent, getApprovedParams);
      const parsedGetApproved = JSON.parse(getApprovedResult);
      const approvedAddressDecimal = BigInt(
        validateAndParseAddress(approvedAddress)
      ).toString();

      expect(parsedGetApproved).toMatchObject({
        status: 'success',
        approved: approvedAddressDecimal,
      });
    });
  });

  describe('With wrong inputs', () => {
    it('should fail with invalid operator address', async () => {
      const params = {
        approvedAddress: 'invalid_address',
        tokenId: '1',
        contractAddress: NFT_ADDRESS,
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
      });
    });

    it('should fail with invalid agent', async () => {
      const params = {
        approvedAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        tokenId: '1',
        contractAddress: NFT_ADDRESS,
      };

      const result = await approve(wrong_agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
