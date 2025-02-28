"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSignatureTools = void 0;
const schema_1 = require("../schemas/schema");
const createAccount_1 = require("../actions/createAccount");
const deployAccount_1 = require("../actions/deployAccount");
const registerSignatureTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'create_braavos_account',
        description: 'create braavos account return the privateKey/publicKey/contractAddress',
        execute: createAccount_1.CreateBraavosAccountSignature,
    }),
        StarknetToolRegistry.push({
            name: 'deploy_braavos_account',
            description: 'deploy braavos account return the privateKey/publicKey/contractAddress',
            schema: schema_1.accountDetailsSchema,
            execute: deployAccount_1.DeployBraavosAccountSignature,
        });
};
exports.registerSignatureTools = registerSignatureTools;
//# sourceMappingURL=signature_tools.js.map