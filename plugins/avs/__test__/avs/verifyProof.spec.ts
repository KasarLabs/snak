import { jest } from '@jest/globals';
import type { ProofVerifier } from '../../src/actions/verifyProof';
let contractCallMock: jest.Mock;

jest.mock('starknet', () => {
  contractCallMock = jest.fn().mockResolvedValue({ is_valid: '1' } as never);

  return {
    RpcProvider: jest.fn().mockImplementation(() => ({
      getBlock: jest
        .fn()
        .mockResolvedValue({ status: 'ACCEPTED_ON_L2' } as never),
      callContract: jest.fn().mockResolvedValue({ result: ['1'] } as never),
    })),
    Contract: jest.fn().mockImplementation(() => ({
      call: (...args: any[]) => contractCallMock(...args),
    })),
    CallData: {
      compile: jest.fn().mockImplementation((data) => data),
    },
  };
});

import { verifyProof } from '../../src/actions/verifyProof';
import { RpcProvider } from 'starknet';

const mockData = {} as any;

describe('verifyProof action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STARKNET_RPC_URL = 'https://testnet-rpc.example.com';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should verify a valid proof', async () => {
    contractCallMock.mockResolvedValueOnce({ is_valid: '1' } as never);

    const validProofData = {
      blockHash:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      proof: {
        programOutput: ['0xabcdef', '0x123456'],
        publicInput: ['0xfedcba', '0x987654'],
        proofParams: {
          securityLevel: 128,
          numQueries: 30,
          blowupFactor: 8,
        },
      },
    };

    const result = await verifyProof(mockData, validProofData);

    expect(RpcProvider).toHaveBeenCalled();
    expect(result).toEqual({
      isValid: true,
      blockHash: validProofData.blockHash,
      proofSummary: {
        programOutputSize: 2,
        publicInputSize: 2,
        securityLevel: 128,
      },
    });
  });

  it('should return invalid when block verification fails', async () => {
    const mockProvider = new RpcProvider();
    (mockProvider.getBlock as jest.Mock).mockResolvedValueOnce({
      status: 'REJECTED',
    } as never);

    (RpcProvider as unknown as jest.Mock).mockImplementationOnce(
      () => mockProvider
    );

    const proofData = {
      blockHash:
        '0xdeadbeef0000000000000000000000000000000000000000000000000000dead',
      proof: {
        programOutput: ['0x1', '0x2'],
        publicInput: ['0x3', '0x4'],
        proofParams: {
          securityLevel: 128,
          numQueries: 30,
          blowupFactor: 8,
        },
      },
    };

    const result = await verifyProof(mockData, proofData);

    expect(result).toEqual({
      isValid: false,
      reason: 'Block not found or not accepted on Starknet',
      blockHash: proofData.blockHash,
    });
  });

  it('should return invalid when proof verification fails', async () => {
    const fakeVerifier: ProofVerifier = async () => false;
    const proofData = {
      blockHash:
        '0xfefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefefe',
      proof: {
        programOutput: ['0x1', '0x2'],
        publicInput: ['0x3', '0x4'],
        proofParams: {
          securityLevel: 128,
          numQueries: 30,
          blowupFactor: 8,
        },
      },
    };

    const result = await verifyProof(mockData, proofData,fakeVerifier);

    expect(result.isValid).toBe(false);
    expect(result.blockHash).toBe(proofData.blockHash);
    expect(result.proofSummary || result.reason).toBeDefined();
  });

  it('should handle errors during verification', async () => {
    const mockProvider = {
      getBlock: jest
        .fn()
        .mockRejectedValueOnce(new Error('RPC connection failed') as never),
    };
    (RpcProvider as unknown as jest.Mock).mockImplementationOnce(
      () => mockProvider
    );

    const proofData = {
      blockHash:
        '0xbadbeef000000000000000000000000000000000000000000000000000bad00',
      proof: {
        programOutput: ['0x1', '0x2'],
        publicInput: ['0x3', '0x4'],
        proofParams: {
          securityLevel: 128,
          numQueries: 30,
          blowupFactor: 8,
        },
      },
    };

    const result = await verifyProof(mockData, proofData);

    expect(result.isValid).toBe(false);
    expect(result.blockHash).toBe(proofData.blockHash);
    expect(result.error || result.reason).toBeDefined();
  });
});
