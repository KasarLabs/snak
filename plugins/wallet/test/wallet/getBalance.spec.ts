import { jest } from '@jest/globals';
import { getBalance } from '../../src/actions/getBalance.ts';
import { RpcProvider, Contract } from 'starknet';

type MockedRpcProvider = jest.Mocked<InstanceType<typeof RpcProvider>>;
type MockedContract = jest.Mocked<InstanceType<typeof Contract>>;

jest.mock('starknet', () => {
  const mockContract: Partial<MockedContract> = {
    get_balance: jest.fn().mockResolvedValue('1000000000000000000' as never),
  };

  return {
    RpcProvider: jest.fn().mockImplementation(() => {
      return {
        getClassAt: jest.fn().mockResolvedValue({
          abi: ['mock_abi_item'],
        } as never),
      };
    }),
    Contract: jest.fn().mockImplementation(() => mockContract),
  };
});

describe('getBalance action', () => {
  const mockAgent = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STARKNET_RPC_URL = 'https://testnet-rpc.example.com';
  });

  it('should fetch the balance for a valid address', async () => {
    const address =
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const result = await getBalance(mockAgent, { address });

    expect(RpcProvider).toHaveBeenCalledWith({
      nodeUrl: 'https://testnet-rpc.example.com',
    });

    const provider = (RpcProvider as unknown as jest.Mock).mock.results[0]
      .value as MockedRpcProvider;
    expect(provider.getClassAt).toHaveBeenCalledWith(address);

    expect(Contract).toHaveBeenCalledWith(['mock_abi_item'], address, provider);

    const contract = (Contract as jest.Mock).mock.results[0]
      .value as MockedContract;
    expect(contract.get_balance).toHaveBeenCalled();

    expect(result).toEqual({
      balance: '1000000000000000000',
      address,
    });
  });

  it('should throw an error when fetching balance fails', async () => {
    const address =
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const mockProvider = {
        getClassAt: jest.fn().mockRejectedValue(new Error('Failed to fetch class') as never),
      };
      (RpcProvider as unknown as jest.Mock).mockImplementationOnce(() => mockProvider);
      
      await expect(getBalance(mockAgent, { address })).rejects.toThrow(
        `Failed to fetch balance for address ${address}`
      );
  })

  it('should throw an error when abi is undefined', async () => {
    const address =
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  
    const mockProvider = {
      getClassAt: jest.fn().mockResolvedValue({ abi: undefined } as never),
    };
  
    (RpcProvider as unknown as jest.Mock).mockImplementationOnce(() => mockProvider);
  
    await expect(getBalance(mockAgent, { address })).rejects.toThrow(
      `Failed to fetch balance for address ${address}`
    );
  });
  
});
