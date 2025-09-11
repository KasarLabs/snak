import { wrapAccountCreationResponse } from '../utils/AccountManager.js';
import { accountDetailsSchema } from '../schemas/schema.js';
import { StarknetTool } from '@snakagent/core';
import { DeployBraavosAccount } from '../actions/deployAccount.js';
import { CreateBraavosAccount } from '../actions/createAccount.js';

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  SnakToolRegistry.push({
    name: 'create_new_braavos_account',
    description:
      'Create a new Braavos account and return the privateKey/publicKey/contractAddress',
    plugins: 'braavos',
    execute: async () => {
      const response = await CreateBraavosAccount();
      return wrapAccountCreationResponse(response);
    },
  });

  SnakToolRegistry.push({
    name: 'deploy_existing_braavos_account',
    description:
      'Deploy an existing Braavos Account return the privateKey/publicKey/contractAddress',
    plugins: 'braavos',
    schema: accountDetailsSchema,
    execute: DeployBraavosAccount,
  });
};
