"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockWithReceipts = void 0;
const getBlockWithReceipts = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const blockId = params?.blockId ?? 'latest';
        const block = await provider.getBlockWithReceipts(blockId);
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
exports.getBlockWithReceipts = getBlockWithReceipts;
//# sourceMappingURL=getBlockWithReceipts.js.map