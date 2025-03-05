import { wrapAccountCreationResponse } from '../utils/AccountManager.js';
import { CreateArgentAccount } from '../actions/createAccount.js';
import { DeployArgentAccount } from '../actions/deployAccount.js';
import { accountDetailsSchema } from '../schemas/schema.js';
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
