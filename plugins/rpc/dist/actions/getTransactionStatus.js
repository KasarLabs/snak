"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionStatus = void 0;
const getTransactionStatus = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const status = await provider.getTransactionStatus(params.transactionHash);
        return JSON.stringify({
            status: 'success',
            transactionStatus: status,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTransactionStatus = getTransactionStatus;
//# sourceMappingURL=getTransactionStatus.js.map