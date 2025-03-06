import { declareContract } from '../../actions/declareContract';
import { createMockStarknetAgent, createMockInvalidStarknetAgent } from '../jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Declare Contract', () => {
  describe('With valid agent and parameters', () => {
    it('should successfully declare and deploy a contract', async () => {
      const params = {
        sierraPath: 'src/lib/agent/plugins/contract/contract/token_Test.contract_class.json',
        casmPath: 'src/lib/agent/plugins/contract/contract/token_Test.compiled_contract_class.json'
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      console.log(parsed);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        classHash: expect.any(String),
        contractAddress: expect.any(String)
      });
    });

    it('should successfully declare a contract', async () => {
      const params = {
        sierraPath: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.contract_class.json',
        casmPath: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.compiled_contract_class.json'
      };

      const result = await declareContract(agent, params);
      const parsed = JSON.parse(result as string);

      console.log(parsed);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        classHash: expect.any(String),
        contractAddress: expect.any(String)
      });
    });
  });
});