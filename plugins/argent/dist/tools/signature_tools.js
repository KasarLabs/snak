"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureTools = void 0;
const schema_1 = require("../schemas/schema");
const deployAccount_1 = require("../actions/deployAccount");
const createAccount_1 = require("../actions/createAccount");
const registerSignatureTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'create_argent_account',
        description: 'create argent account return the privateKey/publicKey/contractAddress',
        execute: createAccount_1.CreateArgentAccountSignature,
    }),
        StarknetToolRegistry.push({
            name: 'deploy_argent_account',
            description: 'deploy argent account return the privateKey/publicKey/contractAddress',
            schema: schema_1.accountDetailsSchema,
            execute: deployAccount_1.DeployArgentAccountSignature,
        });
};
exports.registerSignatureTools = registerSignatureTools;
//# sourceMappingURL=signature_tools.js.map