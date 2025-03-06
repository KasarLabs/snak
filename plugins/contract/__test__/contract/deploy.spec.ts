import { getConstructorParams } from '../../src/actions/getConstructorParams';
import { deployContract } from '../../src/actions/deployContract';
import { createMockStarknetAgent, createMockInvalidStarknetAgent } from '../jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Deploy Contract', () => {
  describe('With valid agent and parameters using Sierra and CASM', () => {
    it('should successfully deploy a contract using Sierra and CASM files', async () => {
      const params = {
          classHash: '0x00ac5fc19c77654694424a5cb5a7d0d7c5ef45dbf825608bb503326b0d88714a',
          sierraPath: 'src/contract/token_Test.contract_class.json',
          casmPath: 'src/contract/token_Test.compiled_contract_class.json',
          constructorArgs: ['yo', 'yo', '5', '0x049D0c2F881f9c8A7eE2a02fa46d681f8aca944d7f77E7d8A56ED6416d0a391c']
      }
        const res1 = await getConstructorParams(agent, params);
        const parsed1 = JSON.parse(res1);

        console.log(parsed1);
        expect(parsed1).toMatchObject({
          status: 'success',
          constructorParams: expect.any(Array)
        });

        const result = await deployContract(agent, params);
        const parsed = JSON.parse(result);

        console.log(parsed);
        expect(parsed).toMatchObject({
          status: 'success',
          transactionHash: expect.any(String),
          contractAddress: expect.any(String)
        });
      });
    
  //   it('should handle errors when Sierra or CASM paths are invalid', async () => {
  //     const params = {
  //       classHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  //       sierra: 'invalid/path/to/sierra.json',
  //       casm: 'invalid/path/to/casm.json',
  //       constructorArgs: ['1000000', 'TestToken', 'TTK', '18']
  //     };
      
  //     const result = await deployContract(agent, params);
  //     const parsed = JSON.parse(result);
      
  //     expect(parsed).toMatchObject({
  //       status: 'failure',
  //       error: expect.any(String),
  //       step: 'contract deployment'
  //     });
  //   });
  });
  
  // describe('With valid agent and parameters using ABI path', () => {
  //   it('should successfully deploy a contract using ABI path', async () => {
  //     const params = {
  //       classHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  //       abiPath: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.abi.json',
  //       constructorArgs: ['1000000', 'TestToken', 'TTK', '18']
  //     };
      
  //     const result = await deployContract(agent, params);
  //     const parsed = JSON.parse(result);
      
  //     expect(parsed).toMatchObject({
  //       status: 'success'
  //       // Comment ces lignes car elles sont commentées dans le code d'origine
  //       // transactionHash: expect.any(String),
  //       // contractAddress: expect.any(String)
  //     });
  //   });
  // });
  
  // describe('With invalid parameters', () => {
  //   it('should fail when class hash is missing', async () => {
  //     const params = {
  //       sierra: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.contract_class.json',
  //       casm: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.compiled_contract_class.json',
  //       constructorArgs: ['1000000', 'TestToken', 'TTK', '18']
  //     };
      
  //     const result = await deployContract(agent, params);
  //     const parsed = JSON.parse(result);
      
  //     expect(parsed).toMatchObject({
  //       status: 'failure',
  //       error: 'Class hash is required for deployment',
  //       step: 'contract deployment'
  //     });
  //   });
    
  //   it('should fail when neither ABI path nor Sierra and CASM are provided', async () => {
  //     const params = {
  //       classHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  //       constructorArgs: ['1000000', 'TestToken', 'TTK', '18']
  //     };
      
  //     const result = await deployContract(agent, params);
  //     const parsed = JSON.parse(result);
      
  //     expect(parsed).toMatchObject({
  //       status: 'failure',
  //       error: 'Either ABI path or Sierra and CASM paths are required',
  //       step: 'contract deployment'
  //     });
  //   });
  // });
  
  // describe('With invalid agent', () => {
  //   it('should fail when agent is invalid', async () => {
  //     const params = {
  //       classHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  //       sierra: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.contract_class.json',
  //       casm: 'src/lib/agent/plugins/contract/contract/token_ERC20Token.compiled_contract_class.json',
  //       constructorArgs: ['1000000', 'TestToken', 'TTK', '18']
  //     };
      
  //     const result = await deployContract(wrong_agent, params);
  //     const parsed = JSON.parse(result);
      
  //     expect(parsed).toMatchObject({
  //       status: 'failure',
  //       error: expect.any(String),
  //       step: 'contract deployment'
  //     });
    // });
  // });
});