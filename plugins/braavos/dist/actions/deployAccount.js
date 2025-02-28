"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployBraavosAccountSignature = exports.DeployBraavosAccount = void 0;
const starknet_1 = require("starknet");
const AccountManager_1 = require("../utils/AccountManager");
const contract_1 = require("../constant/contract");
const DeployBraavosAccount = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountManager = new AccountManager_1.AccountManager(provider, contract_1.BRAAVOS_INITIAL_CLASSHASH, contract_1.BRAAVOS_PROXY_CLASSHASH, contract_1.BRAAVOS_ACCOUNT_CLASSHASH);
        const tx = await accountManager.deployAccount(params);
        return JSON.stringify({
            status: 'success',
            wallet: 'Braavos',
            transaction_hash: tx.transactionHash,
            contract_address: tx.contractAddress,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.DeployBraavosAccount = DeployBraavosAccount;
const DeployBraavosAccountSignature = async (params) => {
    try {
        const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        const accountManager = new AccountManager_1.AccountManager(provider, contract_1.BRAAVOS_INITIAL_CLASSHASH, contract_1.BRAAVOS_PROXY_CLASSHASH, contract_1.BRAAVOS_ACCOUNT_CLASSHASH);
        const tx = await accountManager.deployAccount(params);
        return JSON.stringify({
            status: 'success',
            wallet: 'Braavos',
            transaction_hash: tx.transactionHash,
            contract_address: tx.contractAddress,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.DeployBraavosAccountSignature = DeployBraavosAccountSignature;
//# sourceMappingURL=deployAccount.js.map