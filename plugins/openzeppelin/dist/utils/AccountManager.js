"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapAccountCreationResponse = exports.AccountManager = void 0;
const starknet_1 = require("starknet");
class AccountManager {
    constructor(provider) {
        this.provider = provider;
    }
    async createAccount(accountClassHash) {
        try {
            const privateKey = starknet_1.stark.randomAddress();
            const publicKey = starknet_1.ec.starkCurve.getStarkKey(privateKey);
            const constructorCallData = starknet_1.CallData.compile({ publicKey });
            const contractAddress = starknet_1.hash.calculateContractAddressFromHash(publicKey, accountClassHash, constructorCallData, 0);
            return {
                contractAddress,
                privateKey,
                publicKey,
            };
        }
        catch (error) {
            throw new Error(`Failed to create account: ${error.message}`);
        }
    }
    async deployAccount(accountClassHash, accountDetails) {
        try {
            const account = new starknet_1.Account(this.provider, accountDetails.contractAddress, accountDetails.privateKey);
            const constructorCallData = starknet_1.CallData.compile({
                publicKey: accountDetails.publicKey,
            });
            const { transaction_hash, contract_address } = await account.deployAccount({
                classHash: accountClassHash,
                constructorCalldata: constructorCallData,
                addressSalt: accountDetails.publicKey,
            });
            await this.provider.waitForTransaction(transaction_hash);
            return {
                status: 'success',
                transactionHash: transaction_hash,
                contractAddress: contract_address,
            };
        }
        catch (error) {
            throw new Error(`Failed to create account: ${error.message}`);
        }
    }
    async estimateAccountDeployFee(accountClassHash, accountDetails) {
        try {
            const account = new starknet_1.Account(this.provider, accountDetails.contractAddress, accountDetails.privateKey);
            const constructorCallData = starknet_1.CallData.compile({
                publicKey: accountDetails.publicKey,
            });
            return await account.estimateAccountDeployFee({
                classHash: accountClassHash,
                constructorCalldata: constructorCallData,
                addressSalt: accountDetails.publicKey,
            });
        }
        catch (error) {
            throw new Error(`Failed to estimate deploy fee: ${error.message}`);
        }
    }
}
exports.AccountManager = AccountManager;
const wrapAccountCreationResponse = (response) => {
    try {
        const data = JSON.parse(response);
        if (data.status === 'success') {
            return JSON.stringify({
                ...data,
                message: `✅ Your ${data.wallet} account has been successfully created at ${data.contractAddress}\nPublic key: ${data.publicKey}\nPrivate key: ${data.privateKey}`,
            });
        }
        return response;
    }
    catch {
        return response;
    }
};
exports.wrapAccountCreationResponse = wrapAccountCreationResponse;
//# sourceMappingURL=AccountManager.js.map