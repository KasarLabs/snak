"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountDetailsSchema = void 0;
const zod_1 = require("zod");
exports.accountDetailsSchema = zod_1.z.object({
    contractAddress: zod_1.z.string().describe("The address of the account's contract"),
    publicKey: zod_1.z.string().describe('The public key of the account'),
    privateKey: zod_1.z.string().describe('The private key of the account'),
});
//# sourceMappingURL=schema.js.map