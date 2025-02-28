"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOZAccountSignature = exports.CreateOZAccount = void 0;
const starknet_1 = require("starknet");
const contract_1 = require("../constant/contract");
const AccountManager_1 = require("../utils/AccountManager");
const CreateOZAccount = async () => {
    try {
        const accountManager = new AccountManager_1.AccountManager(undefined);
        const accountDetails = await accountManager.createAccount(contract_1.OZ_CLASSHASH);
        return JSON.stringify({
            status: 'success',
            wallet: 'Open Zeppelin',
            publicKey: accountDetails.publicKey,
            privateKey: accountDetails.privateKey,
            contractAddress: accountDetails.contractAddress,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.CreateOZAccount = CreateOZAccount;
const CreateOZAccountSignature = async () => {
    try {
        const provider = new starknet_1.RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
        const accountManager = new AccountManager_1.AccountManager(provider);
        const accountDetails = await accountManager.createAccount(contract_1.OZ_CLASSHASH);
        const suggestedMaxFee = await accountManager.estimateAccountDeployFee(contract_1.OZ_CLASSHASH, accountDetails);
        const maxFee = suggestedMaxFee.suggestedMaxFee * 2n;
        return JSON.stringify({
            status: 'success',
            transaction_type: 'CREATE_ACCOUNT',
            wallet: 'OpenZeppelin',
            publicKey: accountDetails.publicKey,
            privateKey: accountDetails.privateKey,
            contractAddress: accountDetails.contractAddress,
            deployFee: maxFee.toString(),
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.CreateOZAccountSignature = CreateOZAccountSignature;
//# sourceMappingURL=createAccount.js.map