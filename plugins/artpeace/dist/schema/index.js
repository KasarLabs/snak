"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placePixelSchema = exports.placePixelParamSchema = void 0;
const zod_1 = require("zod");
exports.placePixelParamSchema = zod_1.z.object({
    canvasId: zod_1.z
        .union([zod_1.z.number(), zod_1.z.string()])
        .optional()
        .default(0)
        .describe('The id or the unique name of the world to dispose the pixel'),
    xPos: zod_1.z
        .number()
        .optional()
        .nullable()
        .describe('The position on x axe of the pixel'),
    yPos: zod_1.z
        .number()
        .optional()
        .nullable()
        .describe('The position on y axe of the pixel'),
    color: zod_1.z
        .string()
        .optional()
        .default('0')
        .describe('The color of the pixel by name or by hexadecimal'),
});
exports.placePixelSchema = zod_1.z.object({
    params: zod_1.z
        .array(exports.placePixelParamSchema)
        .describe('Array of parameter to place one or multiple pixel, all parameters are optional'),
});
//# sourceMappingURL=index.js.map