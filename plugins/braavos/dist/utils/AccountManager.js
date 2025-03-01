"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapAccountCreationResponse = exports.AccountManager = void 0;
const starknet_1 = require("starknet");
class AccountManager {
    constructor(provider, initialClassHash, proxyClassHash, accountClassHash) {
        this.provider = provider;
        this.initialClassHash = initialClassHash;
        this.proxyClassHash = proxyClassHash;
        this.accountClassHash = accountClassHash;
    }
    async createAccount() {
        try {
            const privateKey = starknet_1.stark.randomAddress();
            const publicKey = starknet_1.ec.starkCurve.getStarkKey(privateKey);
            const initializer = this.calcInit(publicKey);
            const constructorCalldata = this.getProxyConstructor(initializer);
            const contractAddress = starknet_1.hash.calculateContractAddressFromHash(publicKey, this.proxyClassHash, constructorCalldata, 0);
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
    async estimateAccountDeployFee(accountDetails) {
        try {
            const version = starknet_1.constants.TRANSACTION_VERSION.V1;
            const nonce = starknet_1.constants.ZERO;
            const chainId = await this.provider.getChainId();
            const initializer = this.calcInit(accountDetails.publicKey);
            const constructorCalldata = this.getProxyConstructor(initializer);
            const signature = this.getBraavosSignature(accountDetails.contractAddress, constructorCalldata, accountDetails.publicKey, BigInt(version), starknet_1.constants.ZERO, chainId, BigInt(nonce), accountDetails.privateKey);
            const deployAccountPayload = {
                classHash: this.proxyClassHash,
                constructorCalldata,
                addressSalt: accountDetails.publicKey,
                signature,
            };
            const response = await this.provider.getDeployAccountEstimateFee(deployAccountPayload, { version, nonce });
            return starknet_1.stark.estimatedFeeToMaxFee(response.overall_fee);
        }
        catch (error) {
            throw new Error(`Failed to estimate deploy fee: ${error.message}`);
        }
    }
    async deployAccount(accountDetails, maxFee) {
        try {
            const version = starknet_1.constants.TRANSACTION_VERSION.V1;
            const nonce = starknet_1.constants.ZERO;
            const chainId = await this.provider.getChainId();
            const initializer = this.calcInit(accountDetails.publicKey);
            const constructorCalldata = this.getProxyConstructor(initializer);
            maxFee = maxFee ?? (await this.estimateAccountDeployFee(accountDetails));
            const signature = this.getBraavosSignature(accountDetails.contractAddress, constructorCalldata, accountDetails.publicKey, BigInt(version), maxFee, chainId, BigInt(nonce), accountDetails.privateKey);
            const { transaction_hash, contract_address } = await this.provider.deployAccountContract({
                classHash: this.proxyClassHash,
                constructorCalldata,
                addressSalt: accountDetails.publicKey,
                signature,
            }, {
                nonce,
                maxFee,
                version,
            });
            await this.provider.waitForTransaction(transaction_hash);
            return {
                status: 'success',
                transactionHash: transaction_hash,
                contractAddress: contract_address,
            };
        }
        catch (error) {
            throw new Error(`Failed to deploy account: ${error.message}`);
        }
    }
    calcInit(publicKey) {
        return starknet_1.CallData.compile({ public_key: publicKey });
    }
    getProxyConstructor(initializer) {
        return starknet_1.CallData.compile({
            implementation_address: this.initialClassHash,
            initializer_selector: starknet_1.hash.getSelectorFromName('initializer'),
            calldata: [...initializer],
        });
    }
    getBraavosSignature(contractAddress, constructorCalldata, publicKey, version, maxFee, chainId, nonce, privateKey) {
        const txHash = starknet_1.hash.calculateDeployAccountTransactionHash({
            contractAddress,
            classHash: this.proxyClassHash,
            constructorCalldata,
            salt: publicKey,
            version: starknet_1.constants.TRANSACTION_VERSION.V1,
            maxFee,
            chainId,
            nonce,
        });
        const parsedOtherSigner = [0, 0, 0, 0, 0, 0, 0];
        const { r, s } = starknet_1.ec.starkCurve.sign(starknet_1.hash.computeHashOnElements([
            txHash,
            this.accountClassHash,
            ...parsedOtherSigner,
        ]), starknet_1.num.toHex(privateKey));
        return [
            r.toString(),
            s.toString(),
            this.accountClassHash.toString(),
            ...parsedOtherSigner.map((e) => e.toString()),
        ];
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