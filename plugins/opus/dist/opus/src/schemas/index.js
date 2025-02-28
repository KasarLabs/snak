"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgeFeePaidEventSchema = exports.troveOpenedEventSchema = exports.repayTroveSchema = exports.borrowTroveSchema = exports.collateralActionSchema = exports.openTroveSchema = exports.getTroveHealthSchema = exports.getUserTrovesSchema = exports.healthSchema = exports.assetBalancesSchema = exports.assetBalanceSchema = exports.assetBalancesInputSchema = exports.assetBalanceInputSchema = exports.raySchema = exports.wadSchema = exports.valSchema = void 0;
exports.transformVal = transformVal;
const zod_1 = require("zod");
const format_1 = require("../utils/format");
exports.valSchema = zod_1.z.object({ val: zod_1.z.bigint() }).transform(transformVal);
function transformVal(val) {
    return val.val;
}
exports.wadSchema = exports.valSchema.transform((val) => {
    return {
        value: val,
        formatted: (0, format_1.formatValue)(val, 'wad'),
    };
});
exports.raySchema = exports.valSchema.transform((val) => {
    return {
        value: val,
        formatted: (0, format_1.formatValue)(val, 'ray'),
    };
});
exports.assetBalanceInputSchema = zod_1.z.object({
    symbol: zod_1.z.string().describe('Symbol of asset'),
    amount: zod_1.z.string().describe('Amount of asset'),
});
exports.assetBalancesInputSchema = zod_1.z.array(exports.assetBalanceInputSchema);
exports.assetBalanceSchema = zod_1.z.object({
    address: zod_1.z.string().describe('Address of asset'),
    amount: zod_1.z.bigint().describe('Amount of asset'),
});
exports.assetBalancesSchema = zod_1.z.array(exports.assetBalanceSchema);
exports.healthSchema = zod_1.z.object({
    debt: exports.wadSchema.describe('Debt of trove'),
    value: exports.wadSchema.describe('Value of trove'),
    ltv: exports.raySchema.describe('LTV of trove'),
    threshold: exports.raySchema.describe('Threshold of trove'),
});
exports.getUserTrovesSchema = zod_1.z.object({
    user: zod_1.z.string().describe('Address of user'),
});
exports.getTroveHealthSchema = zod_1.z.object({
    troveId: zod_1.z.number().describe('Trove ID'),
});
exports.openTroveSchema = zod_1.z.object({
    collaterals: exports.assetBalancesInputSchema.describe('Collateral assets to deposit'),
    borrowAmount: zod_1.z.string().describe('Amount of CASH to borrow'),
    maxBorrowFeePct: zod_1.z
        .string()
        .regex(/.*%$/, 'Must end with %')
        .describe('Maximum borrow fee as a % of borrow amount'),
});
exports.collateralActionSchema = zod_1.z.object({
    troveId: zod_1.z.number().describe('Trove ID'),
    collateral: exports.assetBalanceInputSchema.describe('Collateral to deposit'),
});
exports.borrowTroveSchema = zod_1.z.object({
    troveId: zod_1.z.number().describe('Trove ID'),
    amount: zod_1.z.string().describe('Amount of CASH to repay'),
    maxBorrowFeePct: zod_1.z
        .string()
        .describe('Maximum borrow fee as a % of borrow amount'),
});
exports.repayTroveSchema = zod_1.z.object({
    troveId: zod_1.z.number().describe('Trove ID'),
    amount: zod_1.z.string().describe('Amount to repay'),
});
exports.troveOpenedEventSchema = zod_1.z.object({
    user: zod_1.z.bigint(),
    trove_id: zod_1.z.bigint(),
});
exports.forgeFeePaidEventSchema = zod_1.z.object({
    trove_id: zod_1.z.bigint(),
    fee: exports.wadSchema,
    fee_pct: exports.wadSchema,
});
//# sourceMappingURL=index.js.map