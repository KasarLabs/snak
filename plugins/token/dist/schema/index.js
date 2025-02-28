"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferSignatureschema = exports.getBalanceSchema = exports.getOwnBalanceSchema = exports.Transferschema = void 0;
const zod_1 = require("zod");
exports.Transferschema = zod_1.z.object({
    recipient_address: zod_1.z.string().describe('The recipient public address'),
    amount: zod_1.z.string().describe('The amount of erc20 token that will be send'),
    symbol: zod_1.z.string().describe('The symbol of the erc20 token'),
});
exports.getOwnBalanceSchema = zod_1.z.object({
    symbol: zod_1.z
        .string()
        .describe('The asset symbol to get the balance of. eg. USDC, ETH'),
});
exports.getBalanceSchema = zod_1.z.object({
    walletAddress: zod_1.z
        .string()
        .describe('The wallet address to get the balance of'),
    assetSymbol: zod_1.z
        .string()
        .describe('The asset symbol to get the balance of. eg. USDC, ETH'),
});
exports.transferSignatureschema = zod_1.z.object({
    payloads: zod_1.z
        .array(exports.Transferschema)
        .describe('Array of payloads for a tranfer transaction'),
});
//# sourceMappingURL=index.js.map