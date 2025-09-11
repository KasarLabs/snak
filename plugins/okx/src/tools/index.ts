import { wrapAccountCreationResponse } from '../utils/AccountManager.js';
import { accountDetailsSchema } from '../schemas/schema.js';
import { StarknetTool } from '@snakagent/core';
import { DeployOKXAccount } from '../actions/deployAccount.js';
import { CreateOKXAccount } from '../actions/createAccount.js';

export const registerTools = (SnakToolRegistry: StarknetTool[]) => {
  SnakToolRegistry.push({
    name: 'create_new_okx_account',
    description:
      'Create a new OKX account and return the privateKey/publicKey/contractAddress',
    plugins: 'okx',
    execute: async () => {
      const response = await CreateOKXAccount();
      return wrapAccountCreationResponse(response);
    },
  });

  SnakToolRegistry.push({
    name: 'deploy_existing_okx_account',
    description:
      'Deploy an existing OKX Account return the privateKey/publicKey/contractAddress',
    plugins: 'okx',
    schema: accountDetailsSchema,
    execute: DeployOKXAccount,
  });
};
