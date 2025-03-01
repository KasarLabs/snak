"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionMonitor = void 0;
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
//# sourceMappingURL=TransactionMonitor.js.map