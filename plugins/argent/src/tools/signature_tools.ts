import { SignatureTool } from '@starknet-agent-kit/agents';
import { accountDetailsSchema } from '../schemas/schema.js';
import { DeployArgentAccountSignature } from '../actions/deployAccount.js';
import { CreateArgentAccountSignature } from '../actions/createAccount.js';

export const registerSignatureTools = (
  StarknetToolRegistry: SignatureTool[]
) => {
  StarknetToolRegistry.push({
    name: 'create_argent_account',
    description:
      'create argent account return the privateKey/publicKey/contractAddress',
    execute: CreateArgentAccountSignature,
  }),
    StarknetToolRegistry.push({
      name: 'deploy_argent_account',
      description:
        'deploy argent account return the privateKey/publicKey/contractAddress',
      schema: accountDetailsSchema,
      execute: DeployArgentAccountSignature,
    });
};
