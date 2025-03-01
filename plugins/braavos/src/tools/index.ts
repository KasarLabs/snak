import { wrapAccountCreationResponse } from '../utils/AccountManager';
import { accountDetailsSchema } from '../schemas/schema';
import {
  StarknetAgentInterface,
  StarknetTool,
} from '@starknet-agent-kit/agents';
import { DeployBraavosAccount } from '../actions/deployAccount';
import { CreateBraavosAccount } from '../actions/createAccount';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'create_new_braavos_account',
    description:
      'Create a new Braavos account and return the privateKey/publicKey/contractAddress',
    plugins: 'braavos',
    execute: async (agent: StarknetAgentInterface) => {
      const response = await CreateBraavosAccount();
      return wrapAccountCreationResponse(response);
    },
  });

  StarknetToolRegistry.push({
    name: 'deploy_existing_braavos_account',
    description:
      'Deploy an existing Braavos Account return the privateKey/publicKey/contractAddress',
    plugins: 'braavos',
    schema: accountDetailsSchema,
    execute: DeployBraavosAccount,
  });
};
