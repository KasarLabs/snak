"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockTransactionsTraces = void 0;
const getBlockTransactionsTraces = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const { blockId } = params;
        const transactionTraces = await provider.getBlockTransactionsTraces(blockId);
        return JSON.stringify({
            status: 'success',
            transactionTraces,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getBlockTransactionsTraces = getBlockTransactionsTraces;
//# sourceMappingURL=getBlockTransactionsTraces.js.map