"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schema");
const transfer_1 = require("../actions/transfer");
const getBalances_1 = require("../actions/getBalances");
const schema_2 = require("../schema");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'transfer',
        plugins: 'token',
        description: 'Transfer ERC20 tokens to a specific address',
        schema: schema_1.Transferschema,
        execute: transfer_1.transfer,
    });
    StarknetToolRegistry.push({
        name: 'get_own_balance',
        plugins: 'token',
        description: 'Get the balance of an asset in your wallet',
        schema: schema_2.getOwnBalanceSchema,
        execute: getBalances_1.getOwnBalance,
    });
    StarknetToolRegistry.push({
        name: 'get_balance',
        plugins: 'token',
        description: 'Get the balance of an asset for a given wallet address',
        schema: schema_1.getBalanceSchema,
        execute: getBalances_1.getBalance,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map