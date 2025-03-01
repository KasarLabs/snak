"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureTools = void 0;
const schema_1 = require("../schemas/schema");
const transfer_1 = require("../actions/transfer");
const approve_1 = require("../actions/approve");
const transferFrom_1 = require("../actions/transferFrom");
const registerSignatureTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'erc20_transfer_from_signature',
        description: 'Return transfer_from json transaction',
        schema: schema_1.transferFromSignatureSchema,
        execute: transferFrom_1.transferFromSignature,
    });
    StarknetToolRegistry.push({
        name: 'erc20_approve_signature',
        description: 'Return approve json transaction',
        schema: schema_1.approveSignatureSchema,
        execute: approve_1.approveSignature,
    });
    StarknetToolRegistry.push({
        name: 'erc20_transfer_signature',
        description: 'Return transfer json transaction',
        schema: schema_1.transferSignatureSchema,
        execute: transfer_1.transferSignature,
    });
};
exports.registerSignatureTools = registerSignatureTools;
//# sourceMappingURL=signature_tools.js.map