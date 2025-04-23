import { wrapAccountCreationResponse } from '../utils/AccountManager.js';
import { accountDetailsSchema } from '../schemas/schema.js';
import { StarknetAgentInterface, StarknetTool } from '@snakagent/core';
import { DeployOZAccount } from '../actions/deployAccount.js';
import { CreateOZAccount } from '../actions/createAccount.js';

export const registerTools = (
  StarknetToolRegistry: StarknetTool[],
  agent?: StarknetAgentInterface
) => {
  StarknetToolRegistry.push({
    name: 'create_new_openzeppelin_account',
    description:
      'Create a new Open Zeppelin account and return the privateKey/publicKey/contractAddress',
    plugins: 'openzeppelin',
    execute: async (agent: StarknetAgentInterface) => {
      const response = await CreateOZAccount();
      return wrapAccountCreationResponse(response);
    },
  });

  StarknetToolRegistry.push({
    name: 'deploy_existing_openzeppelin_account',
    description:
      'Deploy an existing Open Zeppelin Account return the privateKey/publicKey/contractAddress',
    plugins: 'openzeppelin',
    schema: accountDetailsSchema,
    execute: DeployOZAccount,
  });
};
