"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockWithTxs = void 0;
const getBlockWithTxs = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const blockId = params?.blockId ?? 'latest';
        const block = await provider.getBlockWithTxs(blockId);
        return JSON.stringify({
            status: 'success',
            block,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getBlockWithTxs = getBlockWithTxs;
//# sourceMappingURL=getBlockWithTxs.js.map