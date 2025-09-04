import { SignatureTool } from '@snakagent/core';
import { accountDetailsSchema } from '../schemas/schema.js';
import { DeployOKXAccountSignature } from '../actions/deployAccount.js';
import { CreateOKXAccountSignature } from '../actions/createAccount.js';

export const registerSignatureTools = (SnakToolRegistry: SignatureTool[]) => {
  (SnakToolRegistry.push({
    name: 'create_okx_account',
    description:
      'create okx account return the privateKey/publicKey/contractAddress',
    execute: CreateOKXAccountSignature,
  }),
    SnakToolRegistry.push({
      name: 'deploy_okx_account',
      description:
        'deploy okx account return the privateKey/publicKey/contractAddress',
      schema: accountDetailsSchema,
      execute: DeployOKXAccountSignature,
    }));
};
