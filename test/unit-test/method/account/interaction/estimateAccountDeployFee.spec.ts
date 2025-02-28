import { estimateAccountDeployFee } from '../../../../../server/agent/plugins/core/account/actions/estimateAccountDeployFee';
import * as C from '../../../utils/constant';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();

describe('Estimate Account Deploy Fee', () => {
  describe('With perfect match inputs', () => {
    it('should estimate fees successfully with valid payload', async () => {
      // Arrange

      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            classHash: C.class_hash,
            constructorCalldata: [
              '0x6db97f20526e4426d8874148ee83448d370e003d042d669611f7b4cb3917c24',
              '0x0',
            ],
            addressSalt: undefined,
            contractAddress: undefined,
          },
        ],
      };
      // Act
      const result = await estimateAccountDeployFee(params, agent);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed).toEqual({
        status: 'success',
        maxFee: expect.any(String),
        overallFee: expect.any(String),
        gasPrice: expect.any(String),
        gasUsage: expect.any(String),
        unit: expect.any(String),
        resourceBounds: {
          l1_gas: {
            maxAmount: expect.any(String),
            maxPricePerUnit: expect.any(String),
          },
          l2_gas: {
            maxAmount: expect.any(String),
            maxPricePerUnit: expect.any(String),
          },
        },
      });
    });
  });
  describe('With invalid params', () => {
    it('should fail at estimate fee reason : class_hash unvalid', async () => {
      //Arrange
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            classHash: '',
            constructorCalldata: [
              '0x6db97f20526e4426d8874148ee83448d370e003d042d669611f7b4cb3917c24',
              '0x0',
            ],
            addressSalt: undefined,
            contractAddress: undefined,
          },
        ],
      };
      // Act
      const result = await estimateAccountDeployFee(params, agent);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });
    it('should fail at estimate fee reason : constructorCallData unvalid', async () => {
      //Arrange
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            classHash:
              '0x1a736d6ed154502257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003',
            constructorCalldata: ['0x0'],
            addressSalt: undefined,
            contractAddress: undefined,
          },
        ],
      };
      // Act
      const result = await estimateAccountDeployFee(params, agent);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });
  });
});

/*Add Test with private Key and params invalid*/
