"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const AccountManager_1 = require("../utils/AccountManager");
const schema_1 = require("../schemas/schema");
const deployAccount_1 = require("../actions/deployAccount");
const createAccount_1 = require("../actions/createAccount");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'create_new_openzeppelin_account',
        description: 'Create a new Open Zeppelin account and return the privateKey/publicKey/contractAddress',
        plugins: 'openzeppelin',
        execute: async (agent) => {
            const response = await (0, createAccount_1.CreateOZAccount)();
            return (0, AccountManager_1.wrapAccountCreationResponse)(response);
        },
    });
    StarknetToolRegistry.push({
        name: 'deploy_existing_openzeppelin_account',
        description: 'Deploy an existing Open Zeppelin Account return the privateKey/publicKey/contractAddress',
        plugins: 'openzeppelin',
        schema: schema_1.accountDetailsSchema,
        execute: deployAccount_1.DeployOZAccount,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map