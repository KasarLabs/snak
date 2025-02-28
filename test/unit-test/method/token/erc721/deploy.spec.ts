import { deployERC721Contract } from 'src/lib/agent/plugins/erc721/actions/deployERC721';
import { createMockStarknetAgent, createMockInvalidStarknetAgent } from 'test/jest/setEnvVars';

const agent = createMockStarknetAgent();
const wrong_agent = createMockInvalidStarknetAgent();

describe('Declare Contract', () => {
  describe('With valid agent and parameters', () => {
    it('should successfully declare and deploy a contract', async () => {
      const params = {
        name: "Yopla NFT",
        symbol: "YNFT",
        totalSupply: "5",
        baseUri:  "https://ipfs.io/ipfs/bafybeibwdtpsgsgl6r2xbasfnkvlrdmqb5la5arnhtof34r5rfy67nmepa/",
      };

      const result = await deployERC721Contract(agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
        contractAddress: expect.any(String)
      });
    });
  });

  describe('With invalid parameters', () => {
    it('should fail when account credentials are missing', async () => {
      const params = {
        name: "Yopla NFT",
        symbol: "YNFT",
        totalSupply: "5",
        baseUri:  "https://ipfs.io/ipfs/bafybeibwdtpsgsgl6r2xbasfnkvlrdmqb5la5arnhtof34r5rfy67nmepa/",
      };

      const result = await deployERC721Contract(wrong_agent, params);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure'
      });
    });
  });
});