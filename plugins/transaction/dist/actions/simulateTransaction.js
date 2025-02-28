"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simulateDeclareTransaction = exports.simulateDeployTransaction = exports.simulateDeployAccountTransaction = exports.simulateInvokeTransaction = void 0;
const starknet_1 = require("starknet");
const outputSimulateTransaction_1 = require("../utils/outputSimulateTransaction");
const constant_1 = require("../constant");
const simulateInvokeTransaction = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const accountAddress = accountCredentials?.accountPublicKey;
        const accountPrivateKey = accountCredentials?.accountPrivateKey;
        if (!accountAddress || !accountPrivateKey) {
            throw new Error('Account address or private key not configured');
        }
        const account = new starknet_1.Account(provider, accountAddress, accountPrivateKey);
        const invocations = params.payloads.map((payload) => {
            return {
                type: starknet_1.TransactionType.INVOKE,
                payload: {
                    contractAddress: payload.contractAddress,
                    entrypoint: payload.entrypoint,
                    calldata: payload.calldata,
                },
            };
        });
        const simulate_transaction = await account.simulateTransaction(invocations);
        const transaction_output = (0, outputSimulateTransaction_1.TransactionReponseFormat)(simulate_transaction);
        return JSON.stringify({
            status: 'success',
            transaction_output: transaction_output,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.simulateInvokeTransaction = simulateInvokeTransaction;
const simulateDeployAccountTransaction = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey);
        const accountAddress = accountCredentials?.accountPublicKey;
        const accountPrivateKey = accountCredentials?.accountPrivateKey;
        if (!accountAddress || !accountPrivateKey) {
            throw new Error('Account address not configured');
        }
        const invocations = params.payloads.map((payload) => {
            return {
                type: starknet_1.TransactionType.DEPLOY_ACCOUNT,
                payload: {
                    classHash: payload.classHash,
                    constructorCalldata: payload.constructorCalldata ?? [],
                    addressSalt: payload.addressSalt,
                    contractAddress: payload.contractAddress,
                },
            };
        });
        const simulate_transaction = await account.simulateTransaction(invocations, {
            nonce: constant_1.DEFAULT_NONCE,
        });
        const transaction_output = (0, outputSimulateTransaction_1.TransactionReponseFormat)(simulate_transaction);
        return JSON.stringify({
            status: 'success',
            transaction_output: transaction_output,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.simulateDeployAccountTransaction = simulateDeployAccountTransaction;
const simulateDeployTransaction = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey);
        const invocations = params.payloads.map((payload) => {
            return {
                type: starknet_1.TransactionType.DEPLOY,
                payload: {
                    classHash: payload.classHash,
                    salt: payload.salt,
                    constructorCalldata: payload.constructorCalldata,
                    unique: payload.unique,
                },
            };
        });
        const simulate_transaction = await account.simulateTransaction(invocations);
        const transaction_output = (0, outputSimulateTransaction_1.TransactionReponseFormat)(simulate_transaction);
        return JSON.stringify({
            status: 'success',
            transaction_output: transaction_output,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.simulateDeployTransaction = simulateDeployTransaction;
const simulateDeclareTransaction = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const accountCredentials = agent.getAccountCredentials();
        const account = new starknet_1.Account(provider, accountCredentials.accountPublicKey, accountCredentials.accountPrivateKey);
        const invocations = [
            {
                type: starknet_1.TransactionType.DECLARE,
                payload: {
                    contract: params.contract,
                    classHash: params.classHash,
                    casm: params.casm,
                    compiledClassHash: params.compiledClassHash,
                },
            },
        ];
        const simulate_transaction = await account.simulateTransaction(invocations);
        const transaction_output = (0, outputSimulateTransaction_1.TransactionReponseFormat)(simulate_transaction);
        return JSON.stringify({
            status: 'success',
            transaction_output: transaction_output,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.simulateDeclareTransaction = simulateDeclareTransaction;
//# sourceMappingURL=simulateTransaction.js.map