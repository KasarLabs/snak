"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureTools = void 0;
const transfer_1 = require("../actions/transfer");
const getBalances_1 = require("../actions/getBalances");
const schema_1 = require("../schema");
const registerSignatureTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'transfer',
        description: 'return transfer json transaction',
        schema: schema_1.transferSignatureschema,
        execute: transfer_1.transfer_signature,
    }),
        StarknetToolRegistry.push({
            name: 'getbalance',
            description: 'return the amoumt of token at a account address',
            schema: schema_1.getBalanceSchema,
            execute: getBalances_1.getBalanceSignature,
        });
};
exports.registerSignatureTools = registerSignatureTools;
//# sourceMappingURL=tools_signature.js.map