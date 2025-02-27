import { getAllowance } from 'src/lib/agent/plugins/erc20/actions/getAllowance';
import { approve } from 'src/lib/agent/plugins/erc20/actions/approve';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';
import { setupTestEnvironment } from 'test/utils/helpers';
import { symbol } from 'zod';

const agent = createMockStarknetAgent();

setupTestEnvironment();

describe('Get allowance', () => {
  describe('With perfect match inputs', () => {
    it('should get allowance between owner and spender', async () => {
      const params = {
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        amount: '8.2',
        assetAddress: '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'
      };

      const result = await approve(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
      });

      const params2 = {
        ownerAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        assetSymbol: 'STRK',
      };

      const result2 = await getAllowance(agent, params2);
      const parsed2 = JSON.parse(result2);

      expect(parsed2).toMatchObject({
        status: 'success',
        owner: process.env.STARKNET_PUBLIC_ADDRESS,
        spender: process.env.STARKNET_PUBLIC_ADDRESS_2,
      });

      expect(parsed2.allowance).toBeDefined();
      expect(parsed2.allowance).toMatch('8.2');
    });

    it('should get allowance between owner and spender', async () => {
      const params = {
        ownerAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        assetSymbol: 'ETH',
      };

      const result = await getAllowance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        owner: process.env.STARKNET_PUBLIC_ADDRESS,
        spender: process.env.STARKNET_PUBLIC_ADDRESS_2,
      });
      expect(parsed.allowance).toBeDefined();
    });
  });

  describe('With wrong input', () => {
    it('should fail with invalid owner address', async () => {
      const params = {
        ownerAddress: 'invalid_address',
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        assetSymbol: 'ETH',
      };

      const result = await getAllowance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid spender address', async () => {
      const params = {
        ownerAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        spenderAddress: 'invalid_address',
        assetSymbol: 'ETH',
      };

      const result = await getAllowance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid token address', async () => {
      const params = {
        ownerAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        assetSymbol: 'BLBLBLB',
      };

      const result = await getAllowance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
