"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const placePixel_1 = require("../actions/placePixel");
const schema_1 = require("../schema");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'place_pixel',
        plugins: 'art-peace',
        description: 'Places a pixel, all parameters are optional',
        schema: schema_1.placePixelSchema,
        execute: placePixel_1.placePixel,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map