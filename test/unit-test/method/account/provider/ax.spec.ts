import { RpcProvider } from 'starknet';
import * as fs from 'fs';
import { CreateArgentAccountSignature } from '../../../../../server/agent/plugins/argent/actions/createAccount';
import { DeployArgentAccountSignature } from '../../../../../server/agent/plugins/argent/actions/deployAccount';

describe('AX Account Creation and Deployment', () => {
  let provider: RpcProvider;

  beforeAll(() => {
    provider = new RpcProvider({
      nodeUrl: process.env.STARKNET_RPC_URL,
    });
  });

  it('should create a new account and save details', async () => {
    if (process.env.RUN_DEPLOYMENT_TEST) {
      return;
    }

    const result = await CreateArgentAccountSignature();

    const data = JSON.parse(result);

    if (data.status !== 'success') {
      console.log(data.error);
    }
    expect(data.status).toBe('success');
    expect(data.transaction_type).toBe('CREATE_ACCOUNT');
    expect(data.wallet).toBe('AX');

    expect(data.publicKey).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(data.privateKey).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(data.contractAddress).toMatch(/^0x[a-fA-F0-9]+$/);
  }, 30000);

  it('should deploy the account', async () => {
    if (!process.env.RUN_DEPLOYMENT_TEST) {
      return;
    }

    const accountDetails = {
      contractAddress: process.env.ADDRESS as string,
      publicKey: process.env.PUBLICKEY as string,
      privateKey: process.env.PRIVATEKEY as string,
    };

    const result = await DeployArgentAccountSignature(accountDetails);

    const deployResult = JSON.parse(result);
    expect(deployResult.status).toBe('success');

    if (deployResult.status === 'success') {
      console.log('Deployed successfully!');
    } else {
      console.error('Failure:', deployResult.error);
    }
  }, 300000);
});
