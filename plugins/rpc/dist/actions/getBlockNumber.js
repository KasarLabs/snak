"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockNumber = void 0;
const getBlockNumber = async (agent) => {
    const provider = agent.getProvider();
    try {
        const blockNumber = await provider.getBlockNumber();
        return JSON.stringify({
            status: 'success',
            blockNumber,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getBlockNumber = getBlockNumber;
//# sourceMappingURL=getBlockNumber.js.map