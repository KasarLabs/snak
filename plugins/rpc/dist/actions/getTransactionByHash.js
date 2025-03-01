"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionByHash = void 0;
const getTransactionByHash = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const { transactionHash } = params;
        const transaction = await provider.getTransactionByHash(transactionHash);
        return JSON.stringify({
            status: 'success',
            transaction,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTransactionByHash = getTransactionByHash;
//# sourceMappingURL=getTransactionByHash.js.map