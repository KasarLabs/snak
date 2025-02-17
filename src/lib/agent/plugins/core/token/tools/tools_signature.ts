import {
  getBalanceSignatureSchema,
  transferSignatureschema,
} from 'src/lib/agent/schemas/signatureSchemas';
import { StarknetSignatureToolRegistry } from 'src/lib/agent/tools/signatureTools';
import { transfer_signature } from '../actions/transfer';
import { getBalanceSignature } from '../actions/getBalances';

export const registerSignatureToolsToken = () => {
  StarknetSignatureToolRegistry.RegisterSignatureTools({
    name: 'transfer',
    description: 'return transfer json transaction',
    schema: transferSignatureschema,
    execute: transfer_signature,
  }),
    StarknetSignatureToolRegistry.RegisterSignatureTools({
      name: 'getbalance',
      description: 'return the amoumt of token at a account address',
      schema: getBalanceSignatureSchema,
      execute: getBalanceSignature,
    });
};
