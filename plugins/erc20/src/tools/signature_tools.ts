import { SignatureTool } from '@starknet-agent-kit/agents';
import {
  transferFromSignatureSchema,
  approveSignatureSchema,
  transferSignatureSchema,
} from '../schemas/schema';

import { transferSignature } from '../actions/transfer';
import { approveSignature } from '../actions/approve';
import { transferFromSignature } from '../actions/transferFrom';

export const registerSignatureTools = (StarknetToolRegistry: SignatureTool[]) => {
  StarknetToolRegistry.push({
    name: 'erc20_transfer_from_signature',
    description: 'Return transfer_from json transaction',
    schema: transferFromSignatureSchema,
    execute: transferFromSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc20_approve_signature',
    description: 'Return approve json transaction',
    schema: approveSignatureSchema,
    execute: approveSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc20_transfer_signature',
    description: 'Return transfer json transaction',
    schema: transferSignatureSchema,
    execute: transferSignature,
  });
};
