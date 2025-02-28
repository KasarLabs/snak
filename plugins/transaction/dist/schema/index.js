"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateAccountDeployFeeSchema = exports.simulateDeclareTransactionSchema = exports.simulateDeployTransactionSchema = exports.simulateDeployAccountTransactionSchema = exports.simulateInvokeTransactionSchema = exports.declareContractSchema = void 0;
const zod_1 = __importDefault(require("zod"));
exports.declareContractSchema = zod_1.default.object({
    contract: zod_1.default.any().describe('The compiled contract to be declared'),
    classHash: zod_1.default.string().optional().describe('Optional pre-computed class hash'),
    compiledClassHash: zod_1.default
        .string()
        .optional()
        .describe('Optional compiled class hash for Cairo 1 contracts'),
});
const callSchema = zod_1.default.object({
    contractAddress: zod_1.default.string().describe('The contract Address'),
    entrypoint: zod_1.default.string().describe('The entrypoint'),
    calldata: zod_1.default.array(zod_1.default.string()).or(zod_1.default.record(zod_1.default.any())).optional(),
});
exports.simulateInvokeTransactionSchema = zod_1.default.object({
    accountAddress: zod_1.default.string().describe('Account Address/public key'),
    payloads: zod_1.default.array(callSchema),
});
const PayloadDeployAccountSchema = zod_1.default.object({
    classHash: zod_1.default.string().describe('The class Hash Address'),
    constructorCalldata: zod_1.default.array(zod_1.default.string()).or(zod_1.default.record(zod_1.default.any())).optional(),
    addressSalt: zod_1.default
        .union([zod_1.default.string().regex(/^0x[0-9a-fA-F]+$/), zod_1.default.number(), zod_1.default.bigint()])
        .optional(),
    contractAddressSchema: zod_1.default.string().describe('ContractAddress').optional(),
});
exports.simulateDeployAccountTransactionSchema = zod_1.default.object({
    accountAddress: zod_1.default.string().describe('Account Address'),
    payloads: zod_1.default.array(PayloadDeployAccountSchema),
});
const PayloadDeploySchema = zod_1.default.object({
    classHash: zod_1.default.union([
        zod_1.default.string().regex(/^0x[0-9a-fA-F]+$/),
        zod_1.default.number(),
        zod_1.default.bigint().describe('The class Hash Address'),
    ]),
    addressSalt: zod_1.default
        .union([zod_1.default.string().regex(/^0x[0-9a-fA-F]+$/), zod_1.default.number(), zod_1.default.bigint()])
        .optional(),
    unique: zod_1.default
        .union([
        zod_1.default.string().regex(/^0x[0-9a-fA-F]+$/),
        zod_1.default.boolean().describe('unique true or false'),
    ])
        .optional(),
    constructorCalldata: zod_1.default.array(zod_1.default.string()).or(zod_1.default.record(zod_1.default.any())).optional(),
});
exports.simulateDeployTransactionSchema = zod_1.default.object({
    accountAddress: zod_1.default.string().describe('Account Address'),
    payloads: zod_1.default.array(PayloadDeploySchema),
});
const cairoAssemblySchema = zod_1.default.object({
    prime: zod_1.default.string(),
    compiler_version: zod_1.default.string(),
    bytecode: zod_1.default.array(zod_1.default.string()),
    hints: zod_1.default.record(zod_1.default.any()),
    entry_points_by_type: zod_1.default.object({
        CONSTRUCTOR: zod_1.default.array(zod_1.default.any()),
        EXTERNAL: zod_1.default.array(zod_1.default.any()),
        L1_HANDLER: zod_1.default.array(zod_1.default.any()),
    }),
});
const compiledContractSchema = zod_1.default.object({
    program: zod_1.default.any(),
    entry_points_by_type: zod_1.default.any(),
});
exports.simulateDeclareTransactionSchema = zod_1.default.object({
    accountAddress: zod_1.default.string().describe('Account address'),
    contract: zod_1.default
        .union([zod_1.default.string(), compiledContractSchema])
        .describe('Contract data'),
    classHash: zod_1.default.string().optional().describe('Class hash of the contract'),
    casm: cairoAssemblySchema.optional().describe('Cairo assembly data'),
    compiledClassHash: zod_1.default.string().optional().describe('Compiled class hash'),
});
exports.estimateAccountDeployFeeSchema = zod_1.default.object({
    accountAddress: zod_1.default.string().describe('Account Address'),
    payloads: zod_1.default.array(PayloadDeployAccountSchema),
});
//# sourceMappingURL=index.js.map