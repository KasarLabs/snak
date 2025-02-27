import { deployERC20Contract } from 'src/lib/agent/plugins/erc20/actions/deployERC20';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();

describe('Deploy NFT Contract', () => {
  describe('With perfect match inputs', () => {
    it('should successfully deploy contract', async () => {
      const params = {
        name: 'Ya Token',
        symbol: 'YAT',
        totalSupply: '1',
      };

      const result = await deployERC20Contract(agent, params);
      const parsed = JSON.parse(result);

      console.log("RESULT : ", parsed);
      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        contractAddress: expect.any(String)
      });
    });
  });
});