import { simulateDeployAccountTransaction } from '../../../../server/agent/plugins/core/transaction/actions/simulateTransaction';
import * as C from '../../../utils/constant';
import {
  createMockInvalidStarknetAgent,
  createMockStarknetAgent,
} from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Simulate Deploy_Account Transaction ', () => {
  describe('With perfect match inputs', () => {
    it('should simulate deploy transaction with valid payload[classHash,constructorCalldata]', async () => {
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
          },
        ],
      };

      // Act

      const result = await simulateDeployAccountTransaction(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('success');
    });
    it('should simulate deploy account transaction with valid payload[classHash,constructorCalldata,addressSalt,contractAddress]', async () => {
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
            addressSalt: C.addressSalt,
            contractAddress:
              '0x4321c775c55d2da6fc81b090fc5b71551755b6cdd0fe7bf4b00439afe0987654',
          },
        ],
      };

      // Act
      const result = await simulateDeployAccountTransaction(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('success');
    });
    it('should simulate deploy account transaction with full payload[classHash,constructorCalldata,addressSalt]', async () => {
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
            addressSalt: C.addressSalt,
          },
        ],
      };

      // Act
      const result = await simulateDeployAccountTransaction(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('success');
    });
    it('should simulate deploy account transaction with multiple payloads', async () => {
      // Arrange
      const paramsArray = [
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
          payloads: [
            {
              classHash: C.class_hash,
              constructorCalldata: [
                '0x6db97f20526e4426d8874148ee83448d370e003d042d669611f7b4cb3917c24',
                '0x0',
              ],
              addressSalt: C.addressSalt,
              contractAddress:
                '0x4321c775c55d2da6fc81b090fc5b71551755b6cdd0fe7bf4b00439afe0987654',
            },
          ],
        },
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
          payloads: [
            {
              classHash: C.class_hash,
              constructorCalldata: [
                '0x6db97f20526e4426d8874148ee83448d370e003d042d669611f7b4cb3917c24',
                '0x1',
              ],
            },
          ],
        },
      ];

      // Act & Assert
      for (const params of paramsArray) {
        const result = await simulateDeployAccountTransaction(agent, params);
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe('success');
      }
    });
  });
  describe('With invalid params', () => {
    it('should fail reason : invalid private_key', async () => {
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
          },
        ],
      };

      const invalidAgent = createMockInvalidStarknetAgent();
      // Act

      const result = await simulateDeployAccountTransaction(
        wrong_agent,
        params
      );
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });
    it('should fail reason : invalid classHash for second payload', async () => {
      // Arrange
      const paramsArray = [
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
          payloads: [
            {
              classHash: C.class_hash,
              constructorCalldata: [
                '0x6db97f20526e4426d8874148ee83448d370e003d042d669611f7b4cb3917c24',
                '0x0',
              ],
              addressSalt: C.addressSalt,
              contractAddress:
                '0x4321c775c55d2da6fc81b090fc5b71551755b6cdd0fe7bf4b00439afe0987654',
            },
          ],
        },
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
          payloads: [
            {
              classHash:
                '0x1a7302257f02b1ccdf4d9d1089f80811cd6acad48e6b6a9d1f2003',
              constructorCalldata: [
                '0x6db97f20526e4426d8874148ee83448d370e003d042d669611f7b4cb3917c24',
                '0x1',
              ],
            },
          ],
        },
      ];

      // Act
      const result = await simulateDeployAccountTransaction(
        agent,
        paramsArray[0]
      );
      const parsed = JSON.parse(result);
      const result2 = await simulateDeployAccountTransaction(
        agent,
        paramsArray[1]
      );
      const parsed2 = JSON.parse(result2);

      // Assert
      expect(parsed.status).toBe('success');
      expect(parsed2.status).toBe('failure');
    });
  });
});
