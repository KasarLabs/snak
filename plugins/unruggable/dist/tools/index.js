"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schema");
const getLockedLiquidity_1 = require("../actions/getLockedLiquidity");
const isMemecoin_1 = require("../actions/isMemecoin");
const createMemecoin_1 = require("../actions/createMemecoin");
const launchOnEkubo_1 = require("../actions/launchOnEkubo");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'is_memecoin',
        plugins: 'unruggable',
        description: 'Check if address is a memecoin',
        schema: schema_1.contractAddressSchema,
        execute: isMemecoin_1.isMemecoin,
    });
    StarknetToolRegistry.push({
        name: 'get_locked_liquidity',
        plugins: 'unruggable',
        description: 'Get locked liquidity info for token',
        schema: schema_1.contractAddressSchema,
        execute: getLockedLiquidity_1.getLockedLiquidity,
    });
    StarknetToolRegistry.push({
        name: 'create_memecoin',
        plugins: 'unruggable',
        description: 'Create a new memecoin using the Unruggable Factory',
        schema: schema_1.createMemecoinSchema,
        execute: createMemecoin_1.createMemecoin,
    });
    StarknetToolRegistry.push({
        name: 'launch_on_ekubo',
        plugins: 'unruggable',
        description: 'Launch a memecoin on Ekubo DEX with concentrated liquidity',
        schema: schema_1.launchOnEkuboSchema,
        execute: launchOnEkubo_1.launchOnEkubo,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map