import { z } from 'zod';

/**
 * Schema for checking token allowance between two addresses
 * @typedef {Object} AllowanceSchema
 * @property {string} ownerAddress - The address of the account owner of the tokens
 * @property {string} spenderAddress - The address of the account allowed to spend the tokens
 * @property {string} assetSymbol - The symbol of the token (e.g., 'ETH', 'USDC')
 */
export const getAllowanceSchema = z.object({
  ownerAddress: z
    .string()
    .describe('The address of the account owner of the tokens'),
  spenderAddress: z
    .string()
    .describe('The address of the account allowed to spend the tokens'),
  assetSymbol: z
    .string()
    .describe("The symbol of the token (e.g., 'ETH', 'USDC')"),
});

/**
 * Schema for checking allowances granted by the current user
 * @typedef {Object} MyGivenAllowanceSchema
 * @property {string} spenderAddress - The address of the account allowed to spend the tokens
 * @property {string} assetSymbol - The symbol of the token (e.g., 'ETH', 'USDC')
 */
export const getMyGivenAllowanceSchema = z.object({
  spenderAddress: z
    .string()
    .describe('The address of the account allowed to spend the tokens'),
  assetSymbol: z
    .string()
    .describe("The symbol of the token (e.g., 'ETH', 'USDC')"),
});

/**
 * Schema for checking allowances granted to the current user
 * @typedef {Object} AllowanceGivenToMeSchema
 * @property {string} ownerAddress - The address of the account that granted the allowance
 * @property {string} assetSymbol - The symbol of the token (e.g., 'ETH', 'USDC')
 */
export const getAllowanceGivenToMeSchema = z.object({
  ownerAddress: z
    .string()
    .describe('The address of the account allowed to spend the tokens'),
  assetSymbol: z
    .string()
    .describe("The symbol of the token (e.g., 'ETH', 'USDC')"),
});

/**
 * Schema for getting the total supply of a token
 * @typedef {string} TotalSupplySchema - The symbol of the token to get the total supply for
 */
export const getTotalSupplySchema = z
  .string()
  .describe('The symbol of the token to get the total supply for');

/**
 * Schema for transferring tokens from one address to another using allowance
 * @typedef {Object} TransferFromSchema
 * @property {string} fromAddress - The address to transfer tokens from
 * @property {string} toAddress - The address to transfer tokens to
 * @property {string} amount - The amount of tokens to transfer
 * @property {string} assetSymbol - The symbol of the token to transfer
 */
export const transferFromSchema = z.object({
  fromAddress: z.string().describe('The address to transfer tokens from'),
  toAddress: z.string().describe('The address to transfer tokens to'),
  amount: z.string().describe('The amount of tokens to transfer'),
  assetSymbol: z.string().describe('The symbol of the token to transfer'),
});

/**
 * Schema for batch transfer-from operations
 * @typedef {Object} TransferFromSignatureSchema
 * @property {string} fromAddress - The address to transfer tokens from
 * @property {string} toAddress - The address to transfer tokens to
 * @property {string} amount - The amount of tokens to transfer
 * @property {string} assetSymbol - The symbol of the token to transfer
 */
export const transferFromSignatureSchema = z.object({
  fromAddress: z.string().describe('The address to transfer tokens from'),
  toAddress: z.string().describe('The address to transfer tokens to'),
  amount: z.string().describe('The amount of tokens to transfer'),
  assetSymbol: z.string().describe('The symbol of the token to transfer'),
});

/**
 * Schema for checking token balance of an address
 * @typedef {Object} BalanceSchema
 * @property {string} accountAddress - The address to check the balance for
 * @property {string} assetSymbol - The symbol of the token to check the balance of
 */
export const getBalanceSchema = z.object({
  accountAddress: z.string().describe('The address to check the balance for'),
  assetSymbol: z
    .string()
    .describe('The symbol of the token to check the balance of'),
});

/**
 * Schema for checking token balance of the current user
 * @typedef {Object} OwnBalanceSchema
 * @property {string} assetSymbol - The symbol of the token to check the balance of
 */
export const getOwnBalanceSchema = z.object({
  assetSymbol: z
    .string()
    .describe('The symbol of the token to check the balance of'),
});

/**
 * Schema for generating signature for balance check
 * @typedef {Object} BalanceSignatureSchema
 * @property {string} accountAddress - The address to check the balance for
 * @property {string} assetSymbol - The symbol of the token to check the balance of
 */
export const getBalanceSignatureSchema = z.object({
  accountAddress: z.string().describe('The address to check the balance for'),
  assetSymbol: z
    .string()
    .describe('The symbol of the token to check the balance of'),
});

/**
 * Schema for approving token spending
 * @typedef {Object} ApproveSchema
 * @property {string} spenderAddress - The address being approved to spend tokens
 * @property {string} amount - The amount of tokens being approved
 * @property {string} assetSymbol - The symbol of the token being approved
 */
export const approveSchema = z.object({
  spenderAddress: z
    .string()
    .describe('The address being approved to spend tokens'),
  amount: z.string().describe('The amount of tokens being approved'),
  assetSymbol: z.string().describe('The symbol of the token being approved'),
});

/**
 * Schema for batch approval operations
 * @typedef {Object} ApproveSignatureSchema
 * @property {string} spenderAddress - The address being approved to spend tokens
 * @property {string} amount - The amount of tokens being approved
 * @property {string} assetSymbol - The symbol of the token being approved
 */
export const approveSignatureSchema = z.object({
  spenderAddress: z
    .string()
    .describe('The address being approved to spend tokens'),
  amount: z.string().describe('The amount of tokens being approved'),
  assetSymbol: z.string().describe('The symbol of the token being approved'),
});

/**
 * Schema for transferring tokens
 * @typedef {Object} TransferSchema
 * @property {string} recipientAddress - The address to receive the tokens
 * @property {string} amount - The amount of tokens to transfer
 * @property {string} assetSymbol - The symbol of the token to transfer
 */
export const transferSchema = z.object({
  recipientAddress: z.string().describe('The address to receive the tokens'),
  amount: z.string().describe('The amount of tokens to transfer'),
  assetSymbol: z.string().describe('The symbol of the token to transfer'),
});

/**
 * Schema for batch transfer operations
 * @typedef {Object} TransferSignatureSchema
 * @property {string} recipientAddress - The address to receive the tokens
 * @property {string} amount - The amount of tokens to transfer
 * @property {string} assetSymbol - The symbol of the token to transfer
 */
export const transferSignatureSchema = z.object({
  recipientAddress: z.string().describe('The address to receive the tokens'),
  amount: z.string().describe('The amount of tokens to transfer'),
  assetSymbol: z.string().describe('The symbol of the token to transfer'),
});

/**
 * Schema for deploying an ERC20 token
 * @typedef {Object} DeployERC20Schema
 * @property {string} name - The name of the token
 * @property {string} symbol - The symbol of the token
 * @property {string} totalSupply - The total supply to mint at the deployment time
 */
export const deployERC20Schema = z.object({
  name: z.string().describe('The name of the token'),
  symbol: z.string().describe('The symbol of the token'),
  totalSupply: z.string().describe('The total supply to mint at the deployment time'),
});
