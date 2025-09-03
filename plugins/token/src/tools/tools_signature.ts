import { SignatureTool } from '@snakagent/core';
import { transfer_signature } from '../actions/transfer.js';
import { getBalanceSignature } from '../actions/getBalances.js';
import { getBalanceSchema, transferSignatureschema } from '../schema/index.js';

export const registerSignatureTools = (
  SnakToolRegistry: SignatureTool[]
) => {
  (SnakToolRegistry.push({
    name: 'transfer',
    description: 'return transfer json transaction',
    schema: transferSignatureschema,
    execute: transfer_signature,
  }),
    SnakToolRegistry.push({
      name: 'getbalance',
      description: 'return the amoumt of token at a account address',
      schema: getBalanceSchema,
      execute: getBalanceSignature,
    }));
};
