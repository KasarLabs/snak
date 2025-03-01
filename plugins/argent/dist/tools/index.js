"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const AccountManager_1 = require("../utils/AccountManager");
const createAccount_1 = require("../actions/createAccount");
const deployAccount_1 = require("../actions/deployAccount");
const schema_1 = require("../schemas/schema");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'create_new_argent_account',
        description: 'Creates a new Argent account and return the privateKey/publicKey/contractAddress',
        plugins: 'argent',
        execute: async (agent) => {
            const response = await (0, createAccount_1.CreateArgentAccount)();
            return (0, AccountManager_1.wrapAccountCreationResponse)(response);
        },
    });
    StarknetToolRegistry.push({
        name: 'deploy_existing_argent_account',
        description: 'Deploy an existing Argent Account return the privateKey/publicKey/contractAddress',
        plugins: 'argent',
        schema: schema_1.accountDetailsSchema,
        execute: deployAccount_1.DeployArgentAccount,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map