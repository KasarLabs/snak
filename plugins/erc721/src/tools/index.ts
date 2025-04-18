import {
  ownerOfSchema,
  transferFromSchema,
  getBalanceSchema,
  approveSchema,
  isApprovedForAllSchema,
  getApprovedSchema,
  safeTransferFromSchema,
  setApprovalForAllSchema,
  deployERC721Schema,
  getOwnBalanceSchema,
  transferSchema,
} from '../schemas/schema.js';
import { getOwner } from '../actions/ownerOf.js';
import { transferFrom, transfer } from '../actions/transferFrom.js';
import { getBalance, getOwnBalance } from '../actions/balanceOf.js';
import { approve } from '../actions/approve.js';
import { isApprovedForAll } from '../actions/isApprovedForAll.js';
import { getApproved } from '../actions/getApproved.js';
import { safeTransferFrom } from '../actions/safeTransferFrom.js';
import { setApprovalForAll } from '../actions/setApprovalForAll.js';
import { deployERC721Contract } from '../actions/deployERC721.js';
import { StarknetTool } from '@kasarlabs/core';

export const registerTools = (StarknetToolRegistry: StarknetTool[]) => {
  StarknetToolRegistry.push({
    name: 'erc721_owner_of',
    plugins: 'erc721',
    description: 'Get the owner of a specific NFT',
    schema: ownerOfSchema,
    execute: getOwner,
  });

  StarknetToolRegistry.push({
    name: 'erc721_get_balance',
    plugins: 'erc721',
    description: 'Get the balance of NFTs for a given wallet address',
    schema: getBalanceSchema,
    execute: getBalance,
  });

  StarknetToolRegistry.push({
    name: 'erc721_get_own_balance',
    plugins: 'erc721',
    description: 'Get the balance of NFTs in your wallet',
    schema: getOwnBalanceSchema,
    execute: getOwnBalance,
  });

  StarknetToolRegistry.push({
    name: 'erc721_is_approved_for_all',
    plugins: 'erc721',
    description:
      'Check if an operator is approved for all NFTs of a given owner',
    schema: isApprovedForAllSchema,
    execute: isApprovedForAll,
  });

  StarknetToolRegistry.push({
    name: 'erc721_get_approved',
    plugins: 'erc721',
    description: 'Get the approved address for a specific NFT ERC721',
    schema: getApprovedSchema,
    execute: getApproved,
  });

  StarknetToolRegistry.push({
    name: 'erc721_transfer_from',
    plugins: 'erc721',
    description: 'Transfer a NFT from one address to another',
    schema: transferFromSchema,
    execute: transferFrom,
  });

  StarknetToolRegistry.push({
    name: 'erc721_transfer',
    plugins: 'erc721',
    description: 'Transfer a NFT to a specific address',
    schema: transferSchema,
    execute: transfer,
  });

  StarknetToolRegistry.push({
    name: 'erc721_approve',
    plugins: 'erc721',
    description: 'Approve an address to manage a specific NFT erc721',
    schema: approveSchema,
    execute: approve,
  });

  StarknetToolRegistry.push({
    name: 'erc721_safe_transfer_from',
    plugins: 'erc721',
    description:
      'Safely transfer an NFT from one address to another with additional data',
    schema: safeTransferFromSchema,
    execute: safeTransferFrom,
  });

  StarknetToolRegistry.push({
    name: 'erc721_set_approval_for_all',
    plugins: 'erc721',
    description:
      'Set or revoke approval for an operator to manage all NFTs of the caller',
    schema: setApprovalForAllSchema,
    execute: setApprovalForAll,
  });

  StarknetToolRegistry.push({
    name: 'deploy_erc721',
    plugins: 'erc721',
    description:
      'Create and deploy a new ERC721 contract, returns the address of the deployed contract',
    schema: deployERC721Schema,
    execute: deployERC721Contract,
  });
};
