import { z } from 'zod';

/**
 * Schema for getting an NFT balance for a specific account
 * @typedef {Object} GetBalanceParams
 * @property {string} accountAddress - The address to check the balance for
 * @property {string} contractAddress - The address of the NFT contract
 */
export const getBalanceSchema = z.object({
  accountAddress: z.string().describe('The address to check the balance for'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for getting an NFT balance for a specific account
 * @typedef {Object} GetBalanceParams
 * @property {string} accountAddress - The address to check the balance for
 * @property {string} contractAddress - The address of the NFT contract
 */
export const getOwnBalanceSchema = z.object({
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for getting the owner of an NFT
 * @typedef {Object} OwnerOfParams
 * @property {string} tokenId - The ID of the token
 * @property {string} contractAddress - The address of the NFT contract
 */
export const ownerOfSchema = z.object({
  tokenId: z.string().describe('The ID of the token'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for getting the address that has been approved to transfer the token
 * @typedef {Object} GetApprovedParams
 * @property {string} tokenId - The ID of the token
 * @property {string} contractAddress - The address of the NFT contract
 */
export const getApprovedSchema = z.object({
  tokenId: z.string().describe('The ID of the token'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for checking if an address is approved for all tokens
 * @typedef {Object} IsApprovedForAllParams
 * @property {string} ownerAddress - The address of the token owner
 * @property {string} operatorAddress - The address of the operator to check
 * @property {string} contractAddress - The address of the NFT contract
 */
export const isApprovedForAllSchema = z.object({
  ownerAddress: z.string().describe('The address of the token owner'),
  operatorAddress: z.string().describe('The address of the operator to check'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for transferring an NFT
 * @typedef {Object} TransferFromParams
 * @property {string} fromAddress - The current owner of the token
 * @property {string} toAddress - The address to receive the token
 * @property {string} tokenId - The ID of the token to transfer
 * @property {string} contractAddress - The address of the NFT contract
 */
export const transferFromSchema = z.object({
  fromAddress: z.string().describe('The current owner of the token'),
  toAddress: z.string().describe('The address to receive the token'),
  tokenId: z.string().describe('The ID of the token to transfer'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for transferring an NFT to another address
 * @typedef {Object} TransferFromParams
 * @property {string} toAddress - The address to receive the token
 * @property {string} tokenId - The ID of the token to transfer
 * @property {string} contractAddress - The address of the NFT contract
 */
export const transferSchema = z.object({
  toAddress: z.string().describe('The address to receive the token'),
  tokenId: z.string().describe('The ID of the token to transfer'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for transferring an NFT with additional data
 * @typedef {Object} SafeTransferFromParams
 * @property {string} fromAddress - The current owner of the token
 * @property {string} toAddress - The address to receive the token
 * @property {string} tokenId - The ID of the token to transfer
 * @property {string} contractAddress - The address of the NFT contract
 */
export const safeTransferFromSchema = z.object({
  fromAddress: z.string().describe('The current owner of the token'),
  toAddress: z.string().describe('The address to receive the token'),
  tokenId: z.string().describe('The ID of the token to transfer'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for approving an address to manage a specific NFT
 * @typedef {Object} ApproveParams
 * @property {string} approvedAddress - The address being approved for the token
 * @property {string} tokenId - The ID of the token
 * @property {string} contractAddress - The address of the NFT contract
 */
export const approveSchema = z.object({
  approvedAddress: z
    .string()
    .describe('The address being approved for the token'),
  tokenId: z.string().describe('The ID of the token'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for setting approval for all tokens
 * @typedef {Object} SetApprovalForAllParams
 * @property {string} operatorAddress - The operator address to set approval for
 * @property {boolean} approved - True to approve, false to revoke
 * @property {string} contractAddress - The address of the NFT contract
 */
export const setApprovalForAllSchema = z.object({
  operatorAddress: z
    .string()
    .describe('The operator address to set approval for'),
  approved: z.boolean().describe('True to approve, false to revoke'),
  contractAddress: z.string().describe('The address of the NFT contract'),
});

/**
 * Schema for deploying a new ERC721 contract
 * @typedef {Object} DeployERC721Params
 * @property {string} name - The name of the ERC721 token
 * @property {string} symbol - The symbol of the ERC721 token
 * @property {string} baseUri - The base URI for token metadata
 * @property {string} totalSupply - The total supply to mint at deployment time
 */
export const deployERC721Schema = z.object({
  name: z.string().describe('The name of the ERC721 token'),
  symbol: z.string().describe('The symbol of the ERC721 token'),
  baseUri: z.string().describe('The base URI for token metadata'),
  totalSupply: z
    .string()
    .describe('The total supply to mint at deployment time'),
});
