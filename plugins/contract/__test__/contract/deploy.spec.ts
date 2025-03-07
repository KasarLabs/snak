import { getConstructorParams } from '../../src/actions/getConstructorParams';
import { deployContract } from '../../src/actions/deployContract';
import {
  createMockStarknetAgent,
  createMockInvalidStarknetAgent,
} from '../jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Deploy Contract', () => {
  describe('With valid agent and parameters using Sierra and CASM', () => {
    it('should successfully deploy a contract using Sierra and CASM files', async () => {
      const params = {
        classHash:
          '0x1f91975fd9791306f864167e74f77b11e60f6af9c997e3e79cb28fa9590dc6f',
        sierraPath: 'src/compiled/token_Test.contract_class.json',
        casmPath: 'src/compiled/token_Test.compiled_contract_class.json',
        constructorArgs: [
          'yo',
          'yo',
          '50000000',
          agent.getAccountCredentials().accountPublicKey,
        ],
      };
      const res1 = await getConstructorParams(agent, params);
      const parsed1 = JSON.parse(res1);

      console.log(parsed1);
      expect(parsed1).toMatchObject({
        status: 'success',
        constructorParams: expect.any(Array),
      });

      const result = await deployContract(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        contractAddress: expect.any(String),
      });
    });

    it('should handle errors when Sierra or CASM paths are invalid', async () => {
      const params = {
        classHash:
          '0x1f91975fd9791306f864167e74f77b11e60f6af9c997e3e79cb28fa9590dc6f',
        sierra: 'invalid/path/to/sierra.json',
        casm: 'invalid/path/to/casm.json',
        constructorArgs: ['1000000', 'TestToken', 'TTK', '18'],
      };

      const result = await deployContract(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
        step: 'contract deployment',
      });
    });
  });

  describe('With valid agent and parameters using ABI path', () => {
    it('should successfully deploy a contract using ABI path', async () => {
      const params = {
        classHash:
          '0x1f91975fd9791306f864167e74f77b11e60f6af9c997e3e79cb28fa9590dc6f',
        abiPath: 'src/compiled/abi_tokenTest.json',
        constructorArgs: [
          'yo',
          'yo',
          '50000000',
          agent.getAccountCredentials().accountPublicKey,
        ],
      };

      const result = await deployContract(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        contractAddress: expect.any(String),
      });
    });
  });

  describe('With invalid parameters', () => {
    it('should fail when neither ABI path nor Sierra and CASM are provided', async () => {
      const params = {
        classHash:
          '0x1f91975fd9791306f864167e74f77b11e60f6af9c997e3e79cb28fa9590dc6f',
        constructorArgs: ['1000000', 'TestToken', 'TTK', '18'],
      };

      const result = await deployContract(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: 'Either ABI path or Sierra and CASM paths are required',
        step: 'contract deployment',
      });
    });
  });

  describe('With invalid agent', () => {
    it('should fail when agent is invalid', async () => {
      const params = {
        classHash:
          '0x1f91975fd9791306f864167e74f77b11e60f6af9c997e3e79cb28fa9590dc6f',
        abiPath: 'src/compiled/abi_tokenTest.contract_class.json',
        constructorArgs: [
          'yo',
          'yo',
          '50000000',
          agent.getAccountCredentials().accountPublicKey,
        ],
      };

      const result = await deployContract(wrong_agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
        step: 'contract deployment',
      });
    });
  });
});
