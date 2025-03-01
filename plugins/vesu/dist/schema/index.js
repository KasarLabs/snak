"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawEarnSchema = exports.depositEarnSchema = void 0;
const zod_1 = require("zod");
exports.depositEarnSchema = zod_1.z.object({
    depositTokenSymbol: zod_1.z
        .string()
        .describe("Symbol of the token to deposit (e.g., 'ETH', 'USDC')"),
    depositAmount: zod_1.z.string().describe('Amount of tokens to deposit'),
});
exports.withdrawEarnSchema = zod_1.z.object({
    withdrawTokenSymbol: zod_1.z
        .string()
        .describe("Symbol of the token to withdraw (e.g., 'ETH', 'USDC')"),
});
//# sourceMappingURL=index.js.map