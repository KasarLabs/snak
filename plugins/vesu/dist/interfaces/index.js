"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poolParser = exports.addressSchema = void 0;
const zod_1 = require("zod");
const num_1 = require("../utils/num");
const starknet_1 = require("starknet");
exports.addressSchema = num_1.hexSchemaBase
    .min(50, 'Address must be at least 50 characters long')
    .max(66, 'Address must be at most 66 characters long')
    .refine((value) => {
    if (/[A-F]/.test(value)) {
        return (0, starknet_1.validateChecksumAddress)(value);
    }
    return true;
}, 'Address is not a valid checksum address')
    .transform((value) => {
    const withoutPrefix = value.startsWith('0x') ? value.slice(2) : value;
    const padded = withoutPrefix.padStart(64, '0');
    return `0x${padded}`;
})
    .or(zod_1.z.literal('0x0'));
exports.poolParser = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    owner: exports.addressSchema,
    extensionContractAddress: exports.addressSchema,
    isVerified: zod_1.z.boolean(),
    assets: zod_1.z.any(),
    pairs: zod_1.z.any(),
});
//# sourceMappingURL=index.js.map