"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapAccountCreationResponse = exports.AccountManager = void 0;
const starknet_1 = require("starknet");
class AccountManager {
    constructor(provider) {
        this.provider = provider;
        this.getV3DetailsPayload = () => {
            const maxL1Gas = 2000n;
            const maxL1GasPrice = 600000n * 10n ** 9n;
            return {
                version: 3,
                maxFee: 10n ** 16n,
                feeDataAvailabilityMode: starknet_1.RPC.EDataAvailabilityMode.L1,
                tip: 10n ** 14n,
                paymasterData: [],
                resourceBounds: {
                    l1_gas: {
                        max_amount: starknet_1.num.toHex(maxL1Gas),
                        max_price_per_unit: starknet_1.num.toHex(maxL1GasPrice),
                    },
                    l2_gas: {
                        max_amount: starknet_1.num.toHex(0n),
                        max_price_per_unit: starknet_1.num.toHex(0n),
                    },
                },
            };
        };
    }
    async createAccount(accountClassHash) {
        try {
            const privateKey = starknet_1.stark.randomAddress();
            const publicKey = starknet_1.ec.starkCurve.getStarkKey(privateKey);
            const axSigner = new starknet_1.CairoCustomEnum({ Starknet: { pubkey: publicKey } });
            const axGuardian = new starknet_1.CairoOption(starknet_1.CairoOptionVariant.None);
            const constructorCallData = starknet_1.CallData.compile({
                owner: axSigner,
                guardian: axGuardian,
            });
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
            console.log('Account deploy AX');
            const account = new starknet_1.Account(this.provider, accountDetails.contractAddress, accountDetails.privateKey);
            const axSigner = new starknet_1.CairoCustomEnum({
                Starknet: { pubkey: accountDetails.publicKey },
            });
            const axGuardian = new starknet_1.CairoOption(starknet_1.CairoOptionVariant.None);
            const constructorCallData = starknet_1.CallData.compile({
                owner: axSigner,
                guardian: axGuardian,
            });
            const { transaction_hash, contract_address } = await account.deployAccount({
                classHash: accountClassHash,
                constructorCalldata: constructorCallData,
                contractAddress: accountDetails.contractAddress,
                addressSalt: accountDetails.publicKey,
            }, this.getV3DetailsPayload());
            await this.provider.waitForTransaction(transaction_hash);
            return {
                status: 'success',
                transactionHash: transaction_hash,
                contractAddress: contract_address,
            };
        }
        catch (error) {
            console.log('Error : ', error);
            throw new Error(`Failed to create account: ${error.message}`);
        }
    }
    async estimateAccountDeployFee(accountClassHash, accountDetails) {
        try {
            const account = new starknet_1.Account(this.provider, accountDetails.contractAddress, accountDetails.privateKey);
            const axSigner = new starknet_1.CairoCustomEnum({
                Starknet: { pubkey: accountDetails.publicKey },
            });
            const axGuardian = new starknet_1.CairoOption(starknet_1.CairoOptionVariant.None);
            const constructorCallData = starknet_1.CallData.compile({
                owner: axSigner,
                guardian: axGuardian,
            });
            return await account.estimateAccountDeployFee({
                classHash: accountClassHash,
                constructorCalldata: constructorCallData,
                contractAddress: accountDetails.contractAddress,
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