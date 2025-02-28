import { wrapAccountCreationResponse } from '../utils/AccountManager';
import { accountDetailsSchema } from '../schemas/schema';
import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { DeployOZAccount } from '../actions/deployAccount';
import { CreateOZAccount } from '../actions/createAccount';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
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
