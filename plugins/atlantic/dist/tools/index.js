"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const getProofService_1 = require("../actions/getProofService");
const schema_1 = require("../schema");
const verifyProofService_1 = require("../actions/verifyProofService");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'get_proof_service',
        plugins: 'atlantic',
        description: "Query atlantic api to generate a proof from '.zip' file on starknet and return the query id",
        schema: schema_1.GetProofServiceSchema,
        execute: getProofService_1.getProofService,
    });
    StarknetToolRegistry.push({
        name: 'verify_proof_service',
        plugins: 'atlantic',
        description: "Query atlantic api to verify a proof from '.json' file on starknet and return the query id",
        schema: schema_1.VerifyProofServiceSchema,
        execute: verifyProofService_1.verifyProofService,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map