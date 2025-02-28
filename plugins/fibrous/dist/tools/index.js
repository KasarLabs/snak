"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schema");
const swap_1 = require("../actions/swap");
const schema_2 = require("../schema");
const batchSwap_1 = require("../actions/batchSwap");
const fetchRoute_1 = require("../actions/fetchRoute");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'swap',
        plugins: 'fibrous',
        description: 'Swap a token for another token',
        schema: schema_1.swapSchema,
        execute: swap_1.swapTokensFibrous,
    });
    StarknetToolRegistry.push({
        name: 'batch_swap',
        plugins: 'fibrous',
        description: 'Swap multiple tokens for another token',
        schema: schema_2.batchSwapSchema,
        execute: batchSwap_1.batchSwapTokens,
    });
    StarknetToolRegistry.push({
        name: 'route',
        plugins: 'fibrous',
        description: 'Get a specific route for swapping tokens',
        schema: schema_2.routeSchema,
        execute: fetchRoute_1.getRouteFibrous,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map