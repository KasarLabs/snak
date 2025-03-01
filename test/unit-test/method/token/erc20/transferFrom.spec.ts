import { Mock } from 'node:test';
import { approve } from 'src/lib/agent/plugins/erc20/actions/approve';
import { transferFrom } from 'src/lib/agent/plugins/erc20/actions/transferFrom';
import { createMockStarknetAgent } from 'test/jest/setEnvVars';
import { setupTestEnvironment } from 'test/utils/helpers';
import { StarknetAgentInterface } from '../../../../src/lib/agent/tools/tools';

describe('TransferFrom with prior approval', () => {
  const approvalAmount = '1.0';
  let agent: StarknetAgentInterface;
  let approverAgent: StarknetAgentInterface;

  beforeEach(async () => {
    setupTestEnvironment();

    approverAgent = createMockStarknetAgent();
    approverAgent.getAccountCredentials = () => ({
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY_2 as string,
    });

    const approveParams = {
      spenderAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
      amount: approvalAmount,
      assetSymbol: 'STRK',
    };

    await approve(approverAgent, approveParams);

    agent = createMockStarknetAgent();
    agent.getAccountCredentials = () => ({
      accountPublicKey: process.env.STARKNET_PUBLIC_ADDRESS,
      accountPrivateKey: process.env.STARKNET_PRIVATE_KEY,
    });
  });

  describe('Success scenarios', () => {
    it('should successfully transfer tokens within approved amount', async () => {
      const transferParams = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
        amount: '0.3',
        assetSymbol: 'STRK',
      };

      const transferResult = await transferFrom(agent, transferParams);
      const parsedTransfer = JSON.parse(transferResult);

      expect(parsedTransfer).toMatchObject({
        status: 'success',
        transactionHash: expect.any(String),
      });
    });
  });

  describe('Failure scenarios', () => {
    it('should fail when trying to transfer more than approved amount', async () => {
      const transferParams = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
        amount: '2.0',
        assetSymbol: 'STRK',
      };

      const result = await transferFrom(agent, transferParams);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail when trying to transfer from an address that did not approve', async () => {
      const transferParams = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS as string,
        amount: '0.5',
        assetSymbol: 'STRK',
      };

      const result = await transferFrom(agent, transferParams);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });

  describe('Input validation', () => {
    it('should fail with invalid from address', async () => {
      const transferParams = {
        fromAddress: 'invalid_address',
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
        amount: '0.5',
        assetSymbol: 'STRK',
      };

      const result = await transferFrom(agent, transferParams);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid token symbol', async () => {
      const transferParams = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
        amount: '0.5',
        assetSymbol: 'INVALID_TOKEN',
      };

      const result = await transferFrom(agent, transferParams);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });

    it('should fail with invalid amount format', async () => {
      const transferParams = {
        fromAddress: process.env.STARKNET_PUBLIC_ADDRESS_2 as string,
        toAddress: process.env.STARKNET_PUBLIC_ADDRESS_3 as string,
        amount: 'invalid_amount',
        assetSymbol: 'STRK',
      };

      const result = await transferFrom(agent, transferParams);
      const parsed = JSON.parse(result);

      expect(parsed).toMatchObject({
        status: 'failure',
      });
    });
  });
});
