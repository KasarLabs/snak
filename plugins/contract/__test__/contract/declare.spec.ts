import { declareContract } from '../../src/actions/declareContract';
import { createMockStarknetAgent, createMockInvalidStarknetAgent } from '../jest/setEnvVars';

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
    it('should successfully declare and deploy a contract', async () => {
      const params = {
        sierraPath: 'src/contract/token_Test.contract_class.json',
        casmPath: 'src/contract/token_Test.compiled_contract_class.json'
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      console.log(parsed);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        classHash: expect.any(String),
      });
    });

    // it('should successfully declare a contract', async () => {
    //   const params = {
    //     sierraPath: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.contract_class.json',
    //     casmPath: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.compiled_contract_class.json'
    //   };

    //   const result = await declareContract(agent, params);
    //   const parsed = JSON.parse(result as string);

    //   console.log(parsed);

    //   expect(parsed).toMatchObject({
    //     status: 'success',
    //     transactionHash: expect.any(String),
    //     classHash: expect.any(String),
    //     contractAddress: expect.any(String)
    //   });
    // });
  });
});