import { SignatureTool } from '@starknet-agent-kit/agents';
import { accountDetailsSchema } from '../schemas/schema';
import { CreateBraavosAccountSignature } from '../actions/createAccount';
import { DeployBraavosAccountSignature } from '../actions/deployAccount';

export const registerSignatureTools = (
  StarknetToolRegistry: SignatureTool[]
) => {
  StarknetToolRegistry.push({
    name: 'create_braavos_account',
    description:
      'create braavos account return the privateKey/publicKey/contractAddress',
    execute: CreateBraavosAccountSignature,
  }),
    StarknetToolRegistry.push({
      name: 'deploy_braavos_account',
      description:
        'deploy braavos account return the privateKey/publicKey/contractAddress',
      schema: accountDetailsSchema,
      execute: DeployBraavosAccountSignature,
    });
};
