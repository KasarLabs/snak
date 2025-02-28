"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployArgentAccountSignature = exports.DeployArgentAccount = void 0;
const starknet_1 = require("starknet");
const contract_1 = require("../constant/contract");
const AccountManager_1 = require("../utils/AccountManager");
const DeployArgentAccount = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountManager = new AccountManager_1.AccountManager(provider);
        const tx = await accountManager.deployAccount(contract_1.ARGENT_CLASS_HASH, params);
        return JSON.stringify({
            status: 'success',
            wallet: 'AX',
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
exports.DeployArgentAccount = DeployArgentAccount;
const DeployArgentAccountSignature = async (params) => {
    try {
        const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        const accountManager = new AccountManager_1.AccountManager(provider);
        const tx = await accountManager.deployAccount(contract_1.ARGENT_CLASS_HASH, params);
        return JSON.stringify({
            status: 'success',
            wallet: 'AX',
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
exports.DeployArgentAccountSignature = DeployArgentAccountSignature;
//# sourceMappingURL=deployAccount.js.map