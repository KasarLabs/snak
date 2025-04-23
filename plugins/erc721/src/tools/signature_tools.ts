import {
  transferFromSchema,
  approveSchema,
  setApprovalForAllSchema,
  safeTransferFromSchema,
} from '../schemas/schema.js';
import { transferFromSignature } from '../actions/transferFrom.js';
import { approveSignature } from '../actions/approve.js';
import { setApprovalForAllSignature } from '../actions/setApprovalForAll.js';
import { safeTransferFromSignature } from '../actions/safeTransferFrom.js';
import { SignatureTool } from '@snakagent/core';

export const registerSignatureTools = (
  StarknetToolRegistry: SignatureTool[]
) => {
  StarknetToolRegistry.push({
    name: 'erc721_transfer_from_signature',
    description: 'Return transferFrom json transaction for ERC721 NFT',
    schema: transferFromSchema,
    execute: transferFromSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc721_approve_signature',
    description: 'Return approve json transaction for ERC721 NFT',
    schema: approveSchema,
    execute: approveSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc721_set_approval_for_all_signature',
    description: 'Return setApprovalForAll json transaction for ERC721 NFT',
    schema: setApprovalForAllSchema,
    execute: setApprovalForAllSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc721_safe_transfer_from_signature',
    description: 'Return safeTransferFrom json transaction for ERC721 NFT',
    schema: safeTransferFromSchema,
    execute: safeTransferFromSignature,
  });
};
