"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockWithTxHashes = void 0;
const getBlockWithTxHashes = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const blockId = params?.blockId ?? 'latest';
        const block = await provider.getBlockWithTxHashes(blockId);
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
exports.getBlockWithTxHashes = getBlockWithTxHashes;
//# sourceMappingURL=getBlockWithTxHashes.js.map