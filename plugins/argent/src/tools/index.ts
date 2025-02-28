import { wrapAccountCreationResponse } from '../utils/AccountManager';
import { CreateArgentAccount } from '../actions/createAccount';
import { DeployArgentAccount } from '../actions/deployAccount';
import { accountDetailsSchema } from '../schemas/schema';
import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'create_new_argent_account',
    description:
      'Creates a new Argent account and return the privateKey/publicKey/contractAddress',
    plugins: 'argent',
    execute: async (agent: StarknetAgentInterface) => {
      const response = await CreateArgentAccount();
      return wrapAccountCreationResponse(response);
    },
  });

  StarknetToolRegistry.push({
    name: 'deploy_existing_argent_account',
    description:
      'Deploy an existing Argent Account return the privateKey/publicKey/contractAddress',
    plugins: 'argent',
    schema: accountDetailsSchema,
    execute: DeployArgentAccount,
  });
};
