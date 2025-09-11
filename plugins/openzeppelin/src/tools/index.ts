import { wrapAccountCreationResponse } from '../utils/AccountManager.js';
import { accountDetailsSchema } from '../schemas/schema.js';
import { StarknetTool } from '@snakagent/core';
import { DeployOZAccount } from '../actions/deployAccount.js';
import { CreateOZAccount } from '../actions/createAccount.js';

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  SnakToolRegistry.push({
    name: 'create_new_openzeppelin_account',
    description:
      'Create a new Open Zeppelin account and return the privateKey/publicKey/contractAddress',
    plugins: 'openzeppelin',
    execute: async () => {
      const response = await CreateOZAccount();
      return wrapAccountCreationResponse(response);
    },
  });

  SnakToolRegistry.push({
    name: 'deploy_existing_openzeppelin_account',
    description:
      'Deploy an existing Open Zeppelin Account return the privateKey/publicKey/contractAddress',
    plugins: 'openzeppelin',
    schema: accountDetailsSchema,
    execute: DeployOZAccount,
  });
};
