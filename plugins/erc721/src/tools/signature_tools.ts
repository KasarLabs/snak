import {
  transferFromSchema,
  approveSchema,
  setApprovalForAllSchema,
  safeTransferFromSchema,
} from '../schemas/schema';
import { transferFromSignature } from '../actions/transferFrom';
import { approveSignature } from '../actions/approve';
import { setApprovalForAllSignature } from '../actions/setApprovalForAll';
import { safeTransferFromSignature } from '../actions/safeTransferFrom';
import { SignatureTool } from '@starknet-agent-kit/agents';

export const registerSignatureTools = (StarknetToolRegistry : SignatureTool[]) => {
  StarknetToolRegistry.push({
    name: 'erc721_transferFromSignature',
    description: 'Return transferFrom json transaction for ERC721 NFT',
    schema: transferFromSchema,
    execute: transferFromSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc721_approveSignature',
    description: 'Return approve json transaction for ERC721 NFT',
    schema: approveSchema,
    execute: approveSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc721_setApprovalForAllSignature',
    description: 'Return setApprovalForAll json transaction for ERC721 NFT',
    schema: setApprovalForAllSchema,
    execute: setApprovalForAllSignature,
  });

  StarknetToolRegistry.push({
    name: 'erc721_safeTransferFromSignature',
    description: 'Return safeTransferFrom json transaction for ERC721 NFT',
    schema: safeTransferFromSchema,
    execute: safeTransferFromSignature,
  });
};
