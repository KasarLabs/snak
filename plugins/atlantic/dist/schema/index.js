"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyProofServiceSchema = exports.GetProofServiceSchema = void 0;
const zod_1 = require("zod");
exports.GetProofServiceSchema = zod_1.z.object({
    filename: zod_1.z
        .string()
        .describe('The name of the file you wish to generate the proof'),
});
exports.VerifyProofServiceSchema = zod_1.z.object({
    filename: zod_1.z
        .string()
        .describe('The name of the file you wish to verify the proof'),
    memoryVerification: zod_1.z
        .string()
        .describe('Type of public memory verification.'),
});
//# sourceMappingURL=index.js.map