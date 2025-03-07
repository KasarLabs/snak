import { declareContract } from '../../src/actions/declareContract';
import {
  createMockStarknetAgent,
  createMockInvalidStarknetAgent,
} from '../jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

beforeAll(async () => {
  try {
    const response = await fetch('http://127.0.0.1:5050', { method: 'POST' });
    if (!response.ok) {
      console.warn('StarkNet node is not responding correctly');
    }
  } catch (error) {
    console.error('StarkNet node is not available:', error);
  }
});

describe('Declare Contract', () => {
  describe('With valid agent and parameters', () => {
    it('should successfully declare a contract', async () => {
      const params = {
        sierraPath: 'src/compiled/token_Test.contract_class.json',
        casmPath: 'src/compiled/token_Test.compiled_contract_class.json',
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        classHash: expect.any(String),
      });
    });

    it('should include file paths in successful response', async () => {
      const params = {
        sierraPath: 'src/compiled/token_Test.contract_class.json',
        casmPath: 'src/compiled/token_Test.compiled_contract_class.json',
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        classHash: expect.any(String),
        sierraPath: expect.stringContaining(params.sierraPath),
        casmPath: expect.stringContaining(params.casmPath),
      });
    });
  });

  describe('With invalid agent', () => {
    it('should handle invalid agent configuration', async () => {
      const params = {
        sierraPath: 'src/contract/token_Test.contract_class.json',
        casmPath: 'src/contract/token_Test.compiled_contract_class.json',
      };

      const result = await declareContract(wrong_agent, params);
      const parsed = JSON.parse(result as string);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
        step: 'contract declaration',
      });
    });
  });

  describe('With invalid parameters', () => {
    it('should handle missing file paths', async () => {
      const params = {
        sierraPath: '',
        casmPath: '',
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: 'Sierra and CASM file paths are required',
        step: 'contract declaration',
      });
    });

    it('should handle invalid file paths', async () => {
      const params = {
        sierraPath: 'non_existent/file.contract_class.json',
        casmPath: 'non_existent/file.compiled_contract_class.json',
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      expect(parsed).toMatchObject({
        status: 'failure',
        error: expect.any(String),
        step: 'contract declaration',
      });
    });
  });
});
