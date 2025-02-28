"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeSchema = exports.batchSwapSchema = exports.swapSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.swapSchema = zod_1.default.object({
    sellTokenSymbol: zod_1.default
        .string()
        .describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
    buyTokenSymbol: zod_1.default
        .string()
        .describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
    sellAmount: zod_1.default.number().positive().describe('Amount of tokens to sell'),
});
exports.batchSwapSchema = zod_1.default.object({
    sellTokenSymbols: zod_1.default.array(zod_1.default.string()).describe('Symbols of tokens to sell'),
    buyTokenSymbol: zod_1.default
        .string()
        .describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
    sellAmounts: zod_1.default.array(zod_1.default.number()).describe('Amounts of tokens to sell'),
});
exports.routeSchema = zod_1.default.object({
    sellTokenSymbol: zod_1.default
        .string()
        .describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
    buyTokenSymbol: zod_1.default
        .string()
        .describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
    sellAmount: zod_1.default.number().positive().describe('Amount of tokens to sell'),
});
//# sourceMappingURL=index.js.map