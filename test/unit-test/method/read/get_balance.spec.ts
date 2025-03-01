import { getBalance } from '../../../../server/agent/plugins/core/token/actions/getBalances';
import { Contract } from 'starknet';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';
import { ERC20_ABI } from '../../../../server/agent/plugins/core/token/abis/erc20Abi';

const agent = createMockStarknetAgent();

jest.mock('starknet', () => ({
  Contract: jest.fn((abi, address, provider) => ({
    balanceOf: jest
      .fn()
      .mockImplementation(async () => ({ balance: '2000000000000000000' })),
  })),
  RpcProvider: jest.fn(() => ({
    nodeUrl: process.env.STARKNET_RPC_URL,
  })),
}));

describe('Read -> Get_Balance -> get_balance', () => {
  describe('With perfect match inputs', () => {
    it('should return correct ETH balance when all parameters are valid', async () => {
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        assetSymbol: 'ETH',
      };

      const result = await getBalance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('success');
      expect(Contract).toHaveBeenCalledWith(
        ERC20_ABI,
        expect.any(String),
        expect.any(Object)
      );
      console.log(parsed.balance);
    });

    it('should return correct USDC balance with 6 decimals', async () => {
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        assetSymbol: 'USDC',
      };

      const result = await getBalance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('success');
      console.log(parsed.balance);
    });
  });

  describe('With missing inputs', () => {
    it('should fail reason : unsupported token symbol', async () => {
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        assetSymbol: 'UNKNOWN',
      };

      const result = await getBalance(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed.status).toBe('failure');
    });
  });
});
