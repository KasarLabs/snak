import { StarknetSignatureToolRegistry } from 'src/lib/agent/tools/signatureTools';

import {
  transferFromSignatureSchema,
  approveSignatureSchema,
  transferSignatureSchema,
} from '../schemas/schema';

import { transferSignature } from '../actions/transfer';
import { approveSignature } from '../actions/approve';
import { transferFromSignature } from '../actions/transferFrom';

export const registerSignatureToolsERC20 = () => {
  StarknetSignatureToolRegistry.RegisterSignatureTools({
    name: 'transfer_from',
    description: 'Return transfer_from json transaction',
    schema: transferFromSignatureSchema,
    execute: transferFromSignature,
  });

  StarknetSignatureToolRegistry.RegisterSignatureTools({
    name: 'approve',
    description: 'Return approve json transaction',
    schema: approveSignatureSchema,
    execute: approveSignature,
  });

  StarknetSignatureToolRegistry.RegisterSignatureTools({
    name: 'transfer',
    description: 'Return transfer json transaction',
    schema: transferSignatureSchema,
    execute: transferSignature,
  });
};