import { simulateInvokeTransaction } from '../../../../server/agent/plugins/core/transaction/actions/simulateTransaction';
import * as C from '../../../utils/constant';
import {
  createMockInvalidStarknetAgent,
  createMockStarknetAgent,
} from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Simulate Invoke Transaction', () => {
  describe('With perfect match inputs', () => {
    it('should simulate invoke transaction with valid payload', async () => {
      // Arrange
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            contractAddress: C.contract_address,
            entrypoint: 'transfer',
            calldata: ['0x123...', '1000000000000000000'],
          },
        ],
      };
      // Act
      const result = await simulateInvokeTransaction(agent, params);

      // Assert
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe('success');
      expect(parsed.transaction_output).toBeDefined();
    });
    it('should simulate invoke transaction with valids payloads', async () => {
      // Arrange
      const paramsArray = [
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
          payloads: [
            {
              contractAddress: C.contract_address,
              entrypoint: 'transfer',
              calldata: ['0x123...', '1000000000000000000'],
            },
          ],
        },
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
          payloads: [
            {
              contractAddress: C.contract_address,
              entrypoint: 'approve',
              calldata: ['0x456...', '2000000000000000000'],
            },
          ],
        },
        {
          accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
          payloads: [
            {
              contractAddress: C.contract_address,
              entrypoint: 'transferFrom',
              calldata: ['0x789...', '3000000000000000000'],
            },
          ],
        },
      ];

      // Act & Assert
      for (const params of paramsArray) {
        const result = await simulateInvokeTransaction(agent, params);
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe('success');
        expect(parsed.transaction_output).toBeDefined();
      }
    });
    it('should fail with empty calldata', async () => {
      // Arrange
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            contractAddress: C.contract_address,
            entrypoint: '',
          },
        ],
      };

      // Act
      const result = await simulateInvokeTransaction(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });

    it('should fail reason : invalid privateKey ', async () => {
      // Arrange
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            contractAddress: C.contract_address,
            entrypoint: 'approve',
            calldata: ['0x789...', '3000000000000000000'],
          },
        ],
      };

      // Act
      const result = await simulateInvokeTransaction(wrong_agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });

    it('should fail reason : empty contract address', async () => {
      // Arrange
      const params = {
        accountAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        payloads: [
          {
            contractAddress: '', // Adresse vide
            entrypoint: 'transferFrom',
            calldata: [
              '0x06d8aB6b762E4B4896efCb27960756394033B9b5a5619EaB63Dd5962Bd1173c4',
              '3000000000000000000',
            ],
          },
        ],
      };

      // Act
      const result = await simulateInvokeTransaction(agent, params);
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.status).toBe('failure');
    });
  });
});
