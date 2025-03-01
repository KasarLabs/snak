"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractInteractor = exports.TransactionMonitor = void 0;
class TransactionMonitor {
    constructor(provider, pollingInterval = 5000) {
        this.provider = provider;
        this.pollingInterval = pollingInterval;
    }
    async waitForTransaction(txHash, callback) {
        let receipt;
        while (true) {
            try {
                receipt = await this.provider.getTransactionReceipt(txHash);
                if (callback) {
                    const status = await this.provider.getTransactionStatus(txHash);
                    callback(status);
                }
                if (receipt.finality_status === 'ACCEPTED_ON_L2' ||
                    receipt.finality_status === 'ACCEPTED_ON_L1') {
                    break;
                }
                if (receipt.execution_status === 'REVERTED') {
                    throw new Error(`Transaction ${txHash} was reverted`);
                }
                await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
            }
            catch (error) {
                if (error.message.includes('Transaction hash not found')) {
                    await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
                    continue;
                }
                throw error;
            }
        }
        return receipt;
    }
    async getTransactionEvents(txHash) {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);
            return receipt.events || [];
        }
        catch (error) {
            throw new Error(`Failed to get transaction events: ${error.message}`);
        }
    }
    async watchEvents(fromBlock, toBlock = 'latest', callback) {
        let currentBlock = fromBlock;
        while (true) {
            try {
                const latestBlock = toBlock === 'latest' ? await this.provider.getBlockNumber() : toBlock;
                if (currentBlock > latestBlock) {
                    break;
                }
                const block = await this.provider.getBlockWithTxs(currentBlock);
                const events = [];
                for (const tx of block.transactions) {
                    if (tx.transaction_hash) {
                        const receipt = await this.provider.getTransactionReceipt(tx.transaction_hash);
                        if (receipt.events) {
                            events.push(...receipt.events);
                        }
                    }
                }
                if (events.length > 0) {
                    callback(events);
                }
                currentBlock++;
                await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
            }
            catch (error) {
                console.error('Error watching events:', error);
                await new Promise((resolve) => setTimeout(resolve, this.pollingInterval));
            }
        }
    }
    async getTransactionStatus(txHash) {
        try {
            return await this.provider.getTransactionStatus(txHash);
        }
        catch (error) {
            throw new Error(`Failed to get transaction status: ${error.message}`);
        }
    }
}
exports.TransactionMonitor = TransactionMonitor;
const starknet_1 = require("starknet");
class ContractInteractor {
    constructor(provider) {
        this.provider = provider;
    }
    async deployContract(account, classHash, constructorCalldata = [], salt) {
        try {
            const deployPayload = {
                classHash,
                constructorCalldata: starknet_1.CallData.compile(constructorCalldata),
                salt: salt || starknet_1.hash.getSelectorFromName(Math.random().toString()),
            };
            const { transaction_hash, contract_address } = await account.deploy(deployPayload);
            await this.provider.waitForTransaction(transaction_hash);
            return {
                transactionHash: transaction_hash,
                contractAddress: contract_address,
            };
        }
        catch (error) {
            throw new Error(`Failed to deploy contract: ${error.message}`);
        }
    }
    async estimateContractDeploy(account, classHash, constructorCalldata = [], salt) {
        try {
            const deployPayload = {
                classHash,
                constructorCalldata: starknet_1.CallData.compile(constructorCalldata),
                salt: salt || starknet_1.hash.getSelectorFromName(Math.random().toString()),
            };
            return account.estimateDeployFee(deployPayload);
        }
        catch (error) {
            throw new Error(`Failed to estimate contract deploy: ${error.message}`);
        }
    }
    async multicall(account, calls) {
        try {
            const { transaction_hash } = await account.execute(calls);
            await this.provider.waitForTransaction(transaction_hash);
            return {
                status: 'success',
                transactionHash: transaction_hash,
            };
        }
        catch (error) {
            return {
                status: 'failure',
                error: error.message,
            };
        }
    }
    async estimateMulticall(account, calls) {
        try {
            return account.estimateInvokeFee(calls);
        }
        catch (error) {
            throw new Error(`Failed to estimate multicall: ${error.message}`);
        }
    }
    createContract(abi, address, account) {
        return new starknet_1.Contract(abi, address, account || this.provider);
    }
    async readContract(contract, method, args = []) {
        try {
            return await contract.call(method, args);
        }
        catch (error) {
            throw new Error(`Failed to read contract: ${error.message}`);
        }
    }
    async writeContract(contract, method, args = []) {
        try {
            const { transaction_hash } = await contract.invoke(method, args);
            await this.provider.waitForTransaction(transaction_hash);
            return {
                status: 'success',
                transactionHash: transaction_hash,
            };
        }
        catch (error) {
            return {
                status: 'failure',
                error: error.message,
            };
        }
    }
    async estimateContractWrite(contract, method, args = []) {
        if (!contract.account) {
            throw new Error('Contract must be connected to an account to estimate fees');
        }
        try {
            return await contract.estimate(method, args);
        }
        catch (error) {
            throw new Error(`Failed to estimate contract write: ${error.message}`);
        }
    }
    formatTokenAmount(amount, decimals = 18) {
        const value = typeof amount === 'string' ? amount : amount.toString();
        const [whole, fraction = ''] = value.split('.');
        const paddedFraction = fraction.padEnd(decimals, '0');
        return whole + paddedFraction;
    }
    parseTokenAmount(amount, decimals = 18) {
        const amountBigInt = BigInt(amount);
        const divisor = BigInt(10) ** BigInt(decimals);
        const wholePart = amountBigInt / divisor;
        const fractionPart = amountBigInt % divisor;
        const paddedFraction = fractionPart.toString().padStart(decimals, '0');
        return `${wholePart}.${paddedFraction}`;
    }
}
exports.ContractInteractor = ContractInteractor;
//# sourceMappingURL=index.js.map