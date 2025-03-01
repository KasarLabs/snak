"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BigNumberishSchema = exports.hexSchema = exports.hexSchemaBase = exports.SCALE = void 0;
exports.toHex = toHex;
exports.isEqualHex = isEqualHex;
exports.toNumber = toNumber;
exports.toBN = toBN;
exports.isU256 = isU256;
exports.toU256 = toU256;
exports.toI257 = toI257;
exports.fromI257 = fromI257;
const starknet_1 = require("starknet");
const zod_1 = require("zod");
exports.SCALE = 10n ** 18n;
exports.hexSchemaBase = zod_1.z
    .string()
    .regex(/^0x[a-fA-F0-9]+$/, 'Hex must be a hex string starting with 0x');
exports.hexSchema = exports.hexSchemaBase.transform((v) => v);
function toHex(value) {
    return exports.hexSchema.parse(`0x${toBN(value).toString(16)}`);
}
function isEqualHex(a, b) {
    if (!a || !b)
        return false;
    return toBN(a) === toBN(b);
}
function toNumber(value) {
    const bn = toBN(value);
    if (bn < Number.MIN_SAFE_INTEGER || bn > Number.MAX_SAFE_INTEGER) {
        throw new Error(`Number out of range: ${bn}`);
    }
    return Number(bn);
}
function toBN(value) {
    return isU256(value) ? starknet_1.uint256.uint256ToBN(value) : starknet_1.num.toBigInt(value);
}
const decimalSchema = zod_1.z.string().regex(/^\d+(\.\d+)?$/);
exports.BigNumberishSchema = zod_1.z.union([
    zod_1.z.lazy(() => exports.hexSchema.transform(toBN)),
    zod_1.z.number().transform(toBN),
    decimalSchema.transform(toBN),
    zod_1.z.bigint(),
]);
const u256Schema = zod_1.z.object({
    low: exports.BigNumberishSchema,
    high: exports.BigNumberishSchema,
});
function isU256(value) {
    return u256Schema.safeParse(value).success;
}
function toU256(value) {
    if (isU256(value)) {
        const { low, high } = value;
        return { low: toBN(low), high: toBN(high) };
    }
    const { low, high } = starknet_1.uint256.bnToUint256(toBN(value));
    return { low: toBN(low), high: toBN(high) };
}
function toI257(x) {
    const bn = toBN(x);
    if (bn < 0n) {
        return { abs: -bn, is_negative: true };
    }
    return { abs: bn, is_negative: false };
}
function fromI257(x) {
    const abs = toBN(x.abs);
    return x.is_negative ? -abs : abs;
}
//# sourceMappingURL=num.js.map