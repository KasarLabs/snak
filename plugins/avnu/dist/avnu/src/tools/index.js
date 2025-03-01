"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schema_1 = require("../schema");
const swap_1 = require("../actions/swap");
const fetchRoute_1 = require("../actions/fetchRoute");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'swap_tokens',
        plugins: 'avnu',
        description: 'Swap a specified amount of one token for another token',
        schema: schema_1.swapSchema,
        execute: swap_1.swapTokens,
    });
    StarknetToolRegistry.push({
        name: 'get_route',
        plugins: 'avnu',
        description: 'Get a specific route for swapping tokens',
        schema: schema_1.routeSchema,
        execute: fetchRoute_1.getRoute,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map