"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalanceSignatureSchema = exports.DeployArgentAccountSignatureSchema = exports.transferSignatureschema = exports.Transferschema = void 0;
const zod_1 = require("zod");
exports.Transferschema = zod_1.z.object({
    recipient_address: zod_1.z.string().describe('The recipient public address'),
    amount: zod_1.z.string().describe('The amount'),
    symbol: zod_1.z.string().describe('The symbol of the erc20 token'),
});
exports.transferSignatureschema = zod_1.z.object({
    payloads: zod_1.z
        .array(exports.Transferschema)
        .describe('Array of payloads for a tranfer transaction'),
});
exports.DeployArgentAccountSignatureSchema = zod_1.z.object({
    publicKeyAX: zod_1.z
        .string()
        .describe('The public key to deploy the Argent Account'),
    privateKeyAX: zod_1.z
        .string()
        .describe('The private key to deploy the Argent Account'),
});
exports.getBalanceSignatureSchema = zod_1.z.object({
    accountAddress: zod_1.z.string().describe('the account address'),
    assetSymbol: zod_1.z.string().describe('token Symbol'),
});
//# sourceMappingURL=signatureSchemas.js.map