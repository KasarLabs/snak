"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployERC721Schema = exports.setApprovalForAllSchema = exports.approveSchema = exports.safeTransferFromSchema = exports.transferSchema = exports.transferFromSchema = exports.isApprovedForAllSchema = exports.getApprovedSchema = exports.ownerOfSchema = exports.getOwnBalanceSchema = exports.getBalanceSchema = void 0;
const zod_1 = require("zod");
exports.getBalanceSchema = zod_1.z.object({
    accountAddress: zod_1.z.string().describe('The address to check the balance for'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.getOwnBalanceSchema = zod_1.z.object({
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.ownerOfSchema = zod_1.z.object({
    tokenId: zod_1.z.string().describe('The ID of the token'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.getApprovedSchema = zod_1.z.object({
    tokenId: zod_1.z.string().describe('The ID of the token'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.isApprovedForAllSchema = zod_1.z.object({
    ownerAddress: zod_1.z.string().describe('The address of the token owner'),
    operatorAddress: zod_1.z.string().describe('The address of the operator to check'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.transferFromSchema = zod_1.z.object({
    fromAddress: zod_1.z.string().describe('The current owner of the token'),
    toAddress: zod_1.z.string().describe('The address to receive the token'),
    tokenId: zod_1.z.string().describe('The ID of the token to transfer'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.transferSchema = zod_1.z.object({
    toAddress: zod_1.z.string().describe('The address to receive the token'),
    tokenId: zod_1.z.string().describe('The ID of the token to transfer'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.safeTransferFromSchema = zod_1.z.object({
    fromAddress: zod_1.z.string().describe('The current owner of the token'),
    toAddress: zod_1.z.string().describe('The address to receive the token'),
    tokenId: zod_1.z.string().describe('The ID of the token to transfer'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.approveSchema = zod_1.z.object({
    approvedAddress: zod_1.z
        .string()
        .describe('The address being approved for the token'),
    tokenId: zod_1.z.string().describe('The ID of the token'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.setApprovalForAllSchema = zod_1.z.object({
    operatorAddress: zod_1.z
        .string()
        .describe('The operator address to set approval for'),
    approved: zod_1.z.boolean().describe('True to approve, false to revoke'),
    contractAddress: zod_1.z.string().describe('The address of the NFT contract'),
});
exports.deployERC721Schema = zod_1.z.object({
    name: zod_1.z.string().describe('The name of the ERC721 token'),
    symbol: zod_1.z.string().describe('The symbol of the ERC721 token'),
    baseUri: zod_1.z.string().describe('The base URI for token metadata'),
    totalSupply: zod_1.z
        .string()
        .describe('The total supply to mint at deployment time'),
});
//# sourceMappingURL=schema.js.map