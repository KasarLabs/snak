"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorageAt = void 0;
const getStorageAt = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        const storage = await provider.getStorageAt(params.contractAddress, params.key, params.blockId || 'latest');
        return JSON.stringify({
            status: 'success',
            storage: storage.toString(),
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getStorageAt = getStorageAt;
//# sourceMappingURL=getStorageAt.js.map