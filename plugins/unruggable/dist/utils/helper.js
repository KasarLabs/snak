"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalsScale = exports.execute = void 0;
const starknet_1 = require("starknet");
const constants_1 = require("../constants");
const execute = async (method, agent, calldata, provider) => {
    const accountCredentials = agent.getAccountCredentials();
    const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey);
    return await account.execute({
        contractAddress: constants_1.FACTORY_ADDRESS,
        entrypoint: method,
        calldata: starknet_1.CallData.compile(calldata),
    });
};
exports.execute = execute;
const decimalsScale = (decimals) => `1${Array(decimals).fill('0').join('')}`;
exports.decimalsScale = decimalsScale;
//# sourceMappingURL=helper.js.map