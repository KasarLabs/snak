"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransactionTrace = void 0;
const getTransactionTrace = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const { transactionHash } = params;
        const transactionTrace = await provider.getTransactionTrace(transactionHash);
        return JSON.stringify({
            status: 'success',
            transactionTrace,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTransactionTrace = getTransactionTrace;
//# sourceMappingURL=getTransactionTrace.js.map