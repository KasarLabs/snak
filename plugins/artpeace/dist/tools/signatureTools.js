"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureTools = void 0;
const schema_1 = require("../schema");
const placePixel_1 = require("../actions/placePixel");
const registerSignatureTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'place_pixel',
        description: 'Places a pixel, all parameters are optional',
        schema: schema_1.placePixelSchema,
        execute: placePixel_1.placePixelSignature,
    });
};
exports.registerSignatureTools = registerSignatureTools;
//# sourceMappingURL=signatureTools.js.map