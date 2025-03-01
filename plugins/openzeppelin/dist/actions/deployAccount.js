"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployOZAccountSignature = exports.DeployOZAccount = void 0;
const starknet_1 = require("starknet");
const contract_1 = require("../constant/contract");
const AccountManager_1 = require("../utils/AccountManager");
const DeployOZAccount = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountManager = new AccountManager_1.AccountManager(provider);
        const tx = await accountManager.deployAccount(contract_1.OZ_CLASSHASH, params);
        return JSON.stringify({
            status: 'success',
            wallet: 'OpenZeppelin',
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
exports.DeployOZAccount = DeployOZAccount;
const DeployOZAccountSignature = async (params) => {
    try {
        const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        const accountManager = new AccountManager_1.AccountManager(provider);
        const tx = await accountManager.deployAccount(contract_1.OZ_CLASSHASH, params);
        return JSON.stringify({
            status: 'success',
            wallet: 'OpenZeppelin',
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
exports.DeployOZAccountSignature = DeployOZAccountSignature;
//# sourceMappingURL=deployAccount.js.map