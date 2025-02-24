// index.ts
import { StarknetToolRegistry } from 'src/lib/agent/tools/tools';
import {
  ownerOfSchema,
  transferFromSchema,
  getBalanceSchema,
  approveSchema,
  isApprovedForAllSchema,
  getApprovedSchema,
  safeTransferFromSchema,
  setApprovalForAllSchema
} from '../schemas/schema';
import { getOwner } from '../actions/ownerOf';
import { transferFrom } from '../actions/transferFrom';
import { getBalance } from '../actions/balanceOf';
import { approve } from '../actions/approve';
import { isApprovedForAll } from '../actions/isApprovedForAll';
import { getApproved } from '../actions/getApproved';
import { safeTransferFrom } from '../actions/safeTransferFrom';
import { setApprovalForAll } from '../actions/setApprovalForAll';

export const registerERC721Tools = () => {
  // Read operations
  StarknetToolRegistry.registerTool({
    name: 'erc721_owner_of',
    plugins: 'erc721',
    description: 'Get the owner of a specific NFT',
    schema: ownerOfSchema,
    execute: getOwner,
  });

  StarknetToolRegistry.registerTool({
    name: 'erc721_get_balance',
    plugins: 'erc721',
    description: 'Get the balance of NFTs for a given wallet address',
    schema: getBalanceSchema,
    execute: getBalance,
  });

  StarknetToolRegistry.registerTool({
    name: 'erc721_is_approved_for_all',
    plugins: 'erc721',
    description: 'Check if an operator is approved for all NFTs of a given owner',
    schema: isApprovedForAllSchema,
    execute: isApprovedForAll,
  });

  StarknetToolRegistry.registerTool({
    name: 'erc721_get_approved',
    plugins: 'erc721',
    description: 'Get the approved address for a specific NFT erc721',
    schema: getApprovedSchema,
    execute: getApproved,
  });

  // Write operations
  StarknetToolRegistry.registerTool({
    name: 'erc721_transfer_from',
    plugins: 'erc721',
    description: 'Transfer an NFT from one address to another',
    schema: transferFromSchema,
    execute: transferFrom,
  });

  StarknetToolRegistry.registerTool({
    name: 'erc721_approve',
    plugins: 'erc721',
    description: 'Approve an address to manage a specific NFT erc721',
    schema: approveSchema,
    execute: approve,
  });

  StarknetToolRegistry.registerTool({
    name: 'erc721_safe_transfer_from',
    plugins: 'erc721',
    description: 'Safely transfer an NFT from one address to another with additional data',
    schema: safeTransferFromSchema,
    execute: safeTransferFrom,
  });

  StarknetToolRegistry.registerTool({
    name: 'erc721_set_approval_for_all',
    plugins: 'erc721',
    description: 'Set or revoke approval for an operator to manage all NFTs of the caller',
    schema: setApprovalForAllSchema,
    execute: setApprovalForAll,
  });
};