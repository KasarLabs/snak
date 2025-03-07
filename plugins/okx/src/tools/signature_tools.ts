import { SignatureTool } from '@starknet-agent-kit/agents';
import { accountDetailsSchema } from '../schemas/schema.js';
import { DeployOKXAccountSignature } from '../actions/deployAccount.js';
import { CreateOKXAccountSignature } from '../actions/createAccount.js';

export const registerSignatureTools = (
  StarknetToolRegistry: SignatureTool[]
) => {
  StarknetToolRegistry.push({
    name: 'create_okx_account',
    description:
      'create okx account return the privateKey/publicKey/contractAddress',
    execute: CreateOKXAccountSignature,
  }),
    StarknetToolRegistry.push({
      name: 'deploy_okx_account',
      description:
        'deploy okx account return the privateKey/publicKey/contractAddress',
      schema: accountDetailsSchema,
      execute: DeployOKXAccountSignature,
    });
};
