import {
  createTroveManager,
  TroveManager,
} from '../../src/utils/troveManager.js';
import { createMockStarknetAgent } from '../jest/setEnvVars.js';

const agent = createMockStarknetAgent();

describe('TroveManager', () => {
  let troveManager: TroveManager;
  let mockShrine: any;
  let mockAbbot: any;
  let mockSentinel: any;
  let mockAccount: any;
  let mockErc20: any;

  beforeEach(async () => {
    // Mock Account class
    mockAccount = {
      execute: jest
        .fn()
        .mockResolvedValue({ transaction_hash: 'mock-tx-hash' }),
    };
    jest.mock('starknet', () => ({
      Account: jest.fn().mockImplementation(() => mockAccount),
      num: {
        toBigInt: jest.fn().mockImplementation((value) => BigInt(value)),
      },
    }));

    // Mock the shrine contract
    mockShrine = {
      get_forge_fee_pct: jest
        .fn()
        .mockResolvedValue({ val: BigInt('10000000000000000') }),
      get_trove_health: jest.fn().mockResolvedValue({
        debt: { formatted: '100' },
        value: { formatted: '1000' },
        ltv: { formatted: '10' },
        threshold: { formatted: '80' },
      }),
      parseEvents: jest.fn().mockReturnValue([]),
    };

    // Mock the abbot contract
    mockAbbot = {
      populateTransaction: {
        open_trove: jest.fn().mockReturnValue({
          contractAddress: 'mock-contract',
          entrypoint: 'open_trove',
          calldata: [],
        }),
        deposit: jest.fn().mockReturnValue({
          contractAddress: 'mock-contract',
          entrypoint: 'deposit',
          calldata: [],
        }),
        withdraw: jest.fn().mockReturnValue({
          contractAddress: 'mock-contract',
          entrypoint: 'withdraw',
          calldata: [],
        }),
      },
      get_user_trove_ids: jest.fn(),
      parseEvents: jest.fn().mockReturnValue([
        {
          'opus::core::abbot::abbot::TroveOpened': {
            trove_id: { toString: () => '1' },
          },
        },
      ]),
    };

    mockSentinel = {
      get_yang_addresses: jest.fn().mockResolvedValue([]),
      get_gate_address: jest.fn().mockResolvedValue('mock-gate-address'),
    };

    mockErc20 = {
      decimals: jest.fn().mockResolvedValue(18),
      populateTransaction: {
        approve: jest.fn().mockReturnValue({
          contractAddress: 'mock-token',
          entrypoint: 'approve',
          calldata: [],
        }),
      },
    };

    // Mock the getShrineContract function
    jest.mock('@plugins/opus/utils/contracts', () => ({
      getShrineContract: jest.fn().mockReturnValue(mockShrine),
      getAbbotContract: jest.fn().mockReturnValue(mockAbbot),
      getSentinelContract: jest.fn().mockReturnValue(mockSentinel),
      getErc20Contract: jest.fn().mockReturnValue(mockErc20),
    }));

    // Initialize TroveManager
    troveManager = createTroveManager(agent, 'mock-wallet-address');

    // Mock the initialize method
    jest.spyOn(troveManager, 'initialize').mockImplementation(async () => {
      troveManager.shrine = mockShrine;
      troveManager.abbot = mockAbbot;
      troveManager.sentinel = mockSentinel;
      troveManager.yangs = [BigInt('0x123')];
      return Promise.resolve();
    });
  });

  describe('getBorrowFee', () => {
    it('should return the current borrow fee percentage', async () => {
      const result = await troveManager.getBorrowFee();

      // Verify the result
      expect(result).toEqual({
        status: 'success',
        borrow_fee: '1.0%',
      });

      // Verify that get_forge_fee_pct was called
      expect(mockShrine.get_forge_fee_pct).toHaveBeenCalled();
    });

    it('should return failure status when there is an error', async () => {
      // Mock an error
      mockShrine.get_forge_fee_pct.mockRejectedValue(
        new Error('Contract call failed')
      );

      // Call getUserTroves
      const result = await troveManager.getBorrowFee();

      // Verify the result
      expect(result).toEqual({
        status: 'failure',
      });
    });
  });

  describe('getUserTroves', () => {
    it('should return list of user trove IDs on success', async () => {
      // Mock return value for get_user_trove_ids
      const mockTroveIds = [BigInt(1), BigInt(2), BigInt(3)];
      mockAbbot.get_user_trove_ids.mockResolvedValue(mockTroveIds);

      // Call getUserTroves
      const result = await troveManager.getUserTroves({
        user: 'mock-wallet-address',
      });

      // Verify initialize was called
      expect(troveManager.initialize).toHaveBeenCalled();

      // Verify get_user_trove_ids was called with correct parameter
      expect(mockAbbot.get_user_trove_ids).toHaveBeenCalledWith(
        'mock-wallet-address'
      );

      // Verify the result
      expect(result).toEqual({
        status: 'success',
        troves: ['1', '2', '3'],
      });
    });

    it('should return empty array when user has no troves', async () => {
      // Mock return value for get_user_trove_ids
      mockAbbot.get_user_trove_ids.mockResolvedValue([]);

      // Call getUserTroves
      const result = await troveManager.getUserTroves({
        user: 'mock-wallet-address',
      });

      // Verify the result
      expect(result).toEqual({
        status: 'success',
        troves: [],
      });
    });

    it('should return failure status when there is an error', async () => {
      // Mock an error
      mockAbbot.get_user_trove_ids.mockRejectedValue(
        new Error('Contract call failed')
      );

      // Call getUserTroves
      const result = await troveManager.getUserTroves({
        user: 'mock-wallet-address',
      });

      // Verify the result
      expect(result).toEqual({
        status: 'failure',
      });
    });
  });

  describe('openTroveTransaction', () => {
    it('should handle unknown token symbol during trove opening', async () => {
      const params = {
        collaterals: [{ symbol: 'ABC', amount: '1.0' }],
        borrowAmount: '100',
        maxBorrowFeePct: '1%',
      };

      const result = await troveManager.openTroveTransaction(params, agent);

      expect(result).toEqual({
        status: 'failure',
        error: 'Unknown token symbol ABC',
      });
    });

    it('should handle non-whitelisted tokens during trove opening', async () => {
      const params = {
        collaterals: [{ symbol: 'BROTHER', amount: '1.0' }],
        borrowAmount: '100',
        maxBorrowFeePct: '1%',
      };

      const result = await troveManager.openTroveTransaction(params, agent);

      expect(result).toEqual({
        status: 'failure',
        error:
          '0x3b405a98c9e795d427fe82cdeeeed803f221b52471e3a757574a2b4180793ee is not a valid collateral',
      });
    });
  });

  describe('depositTransaction', () => {
    it('should handle unknown token symbol during deposit', async () => {
      const params = {
        troveId: 1,
        collateral: { symbol: 'ABC', amount: '1.0' },
      };

      const result = await troveManager.depositTransaction(params, agent);

      expect(result).toEqual({
        status: 'failure',
        error: 'Unknown token symbol ABC',
      });
    });

    it('should handle non-whitelisted tokens during deposit', async () => {
      const params = {
        troveId: 1,
        collateral: { symbol: 'BROTHER', amount: '1.0' },
      };

      const result = await troveManager.depositTransaction(params, agent);

      expect(result).toEqual({
        status: 'failure',
        error:
          '0x3b405a98c9e795d427fe82cdeeeed803f221b52471e3a757574a2b4180793ee is not a valid collateral',
      });
    });
  });

  describe('withdrawTransaction', () => {
    it('should handle unknown token symbol during withdraw', async () => {
      const params = {
        troveId: 1,
        collateral: { symbol: 'ABC', amount: '1.0' },
      };

      const result = await troveManager.depositTransaction(params, agent);

      expect(result).toEqual({
        status: 'failure',
        error: 'Unknown token symbol ABC',
      });
    });

    it('should handle non-whitelisted tokens during withdraw', async () => {
      const params = {
        troveId: 1,
        collateral: { symbol: 'BROTHER', amount: '1.0' },
      };

      const result = await troveManager.depositTransaction(params, agent);

      expect(result).toEqual({
        status: 'failure',
        error:
          '0x3b405a98c9e795d427fe82cdeeeed803f221b52471e3a757574a2b4180793ee is not a valid collateral',
      });
    });
  });

  // Clean up after tests
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
});
