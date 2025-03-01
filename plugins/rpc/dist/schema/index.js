"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionHashSchema = exports.getTransactionByBlockIdAndIndexSchema = exports.getClassHashAtSchema = exports.getClassAtSchema = exports.getStorageAtSchema = exports.blockIdAndContractAddressSchema = exports.blockIdSchema = exports.contractAddressSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.contractAddressSchema = zod_1.default.object({
    contractAddress: zod_1.default.string().describe('The address of the contract'),
});
exports.blockIdSchema = zod_1.default.object({
    blockId: zod_1.default.union([
        zod_1.default
            .string()
            .describe("The block identifier. Can be 'latest', 'pending', or a block hash."),
        zod_1.default.number().describe('A block number.'),
    ]),
});
exports.blockIdAndContractAddressSchema = exports.blockIdSchema
    .merge(exports.contractAddressSchema)
    .strict();
exports.getStorageAtSchema = exports.blockIdAndContractAddressSchema.merge(zod_1.default.object({
    key: zod_1.default
        .string()
        .describe('The key to the storage value for the given contract'),
}));
exports.getClassAtSchema = exports.blockIdAndContractAddressSchema.merge(zod_1.default.object({
    key: zod_1.default
        .string()
        .describe('The class for the given contract at the given block'),
}));
exports.getClassHashAtSchema = exports.blockIdAndContractAddressSchema.merge(zod_1.default.object({
    key: zod_1.default
        .string()
        .describe('The class hash for the given contract at the given block'),
}));
exports.getTransactionByBlockIdAndIndexSchema = exports.blockIdSchema.merge(zod_1.default.object({
    transactionIndex: zod_1.default
        .number()
        .int()
        .nonnegative()
        .describe('The index of the transaction within the block.'),
}));
exports.transactionHashSchema = zod_1.default.object({
    transactionHash: zod_1.default
        .string()
        .describe('The hash of the requested transaction.'),
});
//# sourceMappingURL=index.js.map