"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const AccountManager_1 = require("../utils/AccountManager");
const schema_1 = require("../schemas/schema");
const deployAccount_1 = require("../actions/deployAccount");
const createAccount_1 = require("../actions/createAccount");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'create_new_braavos_account',
        description: 'Create a new Braavos account and return the privateKey/publicKey/contractAddress',
        plugins: 'braavos',
        execute: async (agent) => {
            const response = await (0, createAccount_1.CreateBraavosAccount)();
            return (0, AccountManager_1.wrapAccountCreationResponse)(response);
        },
    });
    StarknetToolRegistry.push({
        name: 'deploy_existing_braavos_account',
        description: 'Deploy an existing Braavos Account return the privateKey/publicKey/contractAddress',
        plugins: 'braavos',
        schema: schema_1.accountDetailsSchema,
        execute: deployAccount_1.DeployBraavosAccount,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map