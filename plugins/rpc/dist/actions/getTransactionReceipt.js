"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionReceipt = void 0;
const getTransactionReceipt = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const { transactionHash } = params;
        const receipt = await provider.getTransactionReceipt(transactionHash);
        return JSON.stringify({
            status: 'success',
            receipt,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTransactionReceipt = getTransactionReceipt;
//# sourceMappingURL=getTransactionReceipt.js.map