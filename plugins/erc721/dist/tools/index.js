"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schemas/schema");
const ownerOf_1 = require("../actions/ownerOf");
const transferFrom_1 = require("../actions/transferFrom");
const balanceOf_1 = require("../actions/balanceOf");
const approve_1 = require("../actions/approve");
const isApprovedForAll_1 = require("../actions/isApprovedForAll");
const getApproved_1 = require("../actions/getApproved");
const safeTransferFrom_1 = require("../actions/safeTransferFrom");
const setApprovalForAll_1 = require("../actions/setApprovalForAll");
const deployERC721_1 = require("../actions/deployERC721");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'erc721_owner_of',
        plugins: 'erc721',
        description: 'Get the owner of a specific NFT',
        schema: schema_1.ownerOfSchema,
        execute: ownerOf_1.getOwner,
    });
    StarknetToolRegistry.push({
        name: 'erc721_get_balance',
        plugins: 'erc721',
        description: 'Get the balance of NFTs for a given wallet address',
        schema: schema_1.getBalanceSchema,
        execute: balanceOf_1.getBalance,
    });
    StarknetToolRegistry.push({
        name: 'erc721_is_approved_for_all',
        plugins: 'erc721',
        description: 'Check if an operator is approved for all NFTs of a given owner',
        schema: schema_1.isApprovedForAllSchema,
        execute: isApprovedForAll_1.isApprovedForAll,
    });
    StarknetToolRegistry.push({
        name: 'erc721_get_approved',
        plugins: 'erc721',
        description: 'Get the approved address for a specific NFT erc721',
        schema: schema_1.getApprovedSchema,
        execute: getApproved_1.getApproved,
    });
    StarknetToolRegistry.push({
        name: 'erc721_transfer_from',
        plugins: 'erc721',
        description: 'Transfer an NFT from one address to another',
        schema: schema_1.transferFromSchema,
        execute: transferFrom_1.transferFrom,
    });
    StarknetToolRegistry.push({
        name: 'erc721_approve',
        plugins: 'erc721',
        description: 'Approve an address to manage a specific NFT erc721',
        schema: schema_1.approveSchema,
        execute: approve_1.approve,
    });
    StarknetToolRegistry.push({
        name: 'erc721_safe_transfer_from',
        plugins: 'erc721',
        description: 'Safely transfer an NFT from one address to another with additional data',
        schema: schema_1.safeTransferFromSchema,
        execute: safeTransferFrom_1.safeTransferFrom,
    });
    StarknetToolRegistry.push({
        name: 'erc721_set_approval_for_all',
        plugins: 'erc721',
        description: 'Set or revoke approval for an operator to manage all NFTs of the caller',
        schema: schema_1.setApprovalForAllSchema,
        execute: setApprovalForAll_1.setApprovalForAll,
    });
    StarknetToolRegistry.push({
        name: 'deploy_erc721',
        plugins: 'erc721',
        description: 'Create and deploy a new ERC721 contract, returns the address of the deployed contract',
        schema: schema_1.deployERC721Schema,
        execute: deployERC721_1.deployERC721Contract,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map