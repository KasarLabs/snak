"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployERC20Schema = exports.transferSignatureSchema = exports.transferSchema = exports.approveSignatureSchema = exports.approveSchema = exports.getBalanceSignatureSchema = exports.getOwnBalanceSchema = exports.getBalanceSchema = exports.transferFromSignatureSchema = exports.transferFromSchema = exports.getTotalSupplySchema = exports.getAllowanceGivenToMeSchema = exports.getMyGivenAllowanceSchema = exports.getAllowanceSchema = void 0;
const zod_1 = require("zod");
exports.getAllowanceSchema = zod_1.z.object({
    ownerAddress: zod_1.z
        .string()
        .describe('The address of the account owner of the tokens'),
    spenderAddress: zod_1.z
        .string()
        .describe('The address of the account allowed to spend the tokens'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe("The symbol of the token (e.g., 'ETH', 'USDC')"),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.getMyGivenAllowanceSchema = zod_1.z.object({
    spenderAddress: zod_1.z
        .string()
        .describe('The address of the account allowed to spend the tokens'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe("The symbol of the token (e.g., 'ETH', 'USDC')"),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.getAllowanceGivenToMeSchema = zod_1.z.object({
    ownerAddress: zod_1.z
        .string()
        .describe('The address of the account allowed to spend the tokens'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe("The symbol of the token (e.g., 'ETH', 'USDC')"),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.getTotalSupplySchema = zod_1.z.object({
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to get the total supply for'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.transferFromSchema = zod_1.z.object({
    fromAddress: zod_1.z.string().describe('The address to transfer tokens from'),
    toAddress: zod_1.z.string().describe('The address to transfer tokens to'),
    amount: zod_1.z.string().describe('The amount of tokens to transfer'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to transfer'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.transferFromSignatureSchema = zod_1.z.object({
    fromAddress: zod_1.z.string().describe('The address to transfer tokens from'),
    toAddress: zod_1.z.string().describe('The address to transfer tokens to'),
    amount: zod_1.z.string().describe('The amount of tokens to transfer'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to transfer'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.getBalanceSchema = zod_1.z.object({
    accountAddress: zod_1.z.string().describe('The address to check the balance for'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to check the balance of'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.getOwnBalanceSchema = zod_1.z.object({
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to check the balance of'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.getBalanceSignatureSchema = zod_1.z.object({
    accountAddress: zod_1.z.string().describe('The address to check the balance for'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to check the balance of'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.approveSchema = zod_1.z.object({
    spenderAddress: zod_1.z
        .string()
        .describe('The address being approved to spend tokens'),
    amount: zod_1.z.string().describe('The amount of tokens being approved'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token being approved'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.approveSignatureSchema = zod_1.z.object({
    spenderAddress: zod_1.z
        .string()
        .describe('The address being approved to spend tokens'),
    amount: zod_1.z.string().describe('The amount of tokens being approved'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token being approved'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.transferSchema = zod_1.z.object({
    recipientAddress: zod_1.z.string().describe('The address to receive the tokens'),
    amount: zod_1.z.string().describe('The amount of tokens to transfer'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to transfer'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.transferSignatureSchema = zod_1.z.object({
    recipientAddress: zod_1.z.string().describe('The address to receive the tokens'),
    amount: zod_1.z.string().describe('The amount of tokens to transfer'),
    assetSymbol: zod_1.z
        .string()
        .optional()
        .describe('The symbol of the token to transfer'),
    assetAddress: zod_1.z
        .string()
        .optional()
        .describe('The address of the token contract'),
});
exports.deployERC20Schema = zod_1.z.object({
    name: zod_1.z.string().describe('The name of the token'),
    symbol: zod_1.z.string().describe('The symbol of the token'),
    totalSupply: zod_1.z
        .string()
        .describe('The total supply to mint at the deployment time'),
});
//# sourceMappingURL=schema.js.map