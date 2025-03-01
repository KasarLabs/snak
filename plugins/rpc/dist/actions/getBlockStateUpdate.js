"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockStateUpdate = void 0;
const getBlockStateUpdate = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const blockId = params?.blockId ?? 'latest';
        const block = await provider.getBlockStateUpdate(blockId);
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
exports.getBlockStateUpdate = getBlockStateUpdate;
//# sourceMappingURL=getBlockStateUpdate.js.map