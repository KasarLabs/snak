"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionByBlockIdAndIndex = void 0;
const getTransactionByBlockIdAndIndex = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const { transactionIndex, blockId } = params;
        const transaction = await provider.getTransactionByBlockIdAndIndex(blockId, transactionIndex);
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
exports.getTransactionByBlockIdAndIndex = getTransactionByBlockIdAndIndex;
//# sourceMappingURL=getTransactionByBlockIdAndIndex.js.map