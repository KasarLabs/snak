"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChainId = void 0;
const getChainId = async (agent) => {
    const provider = agent.getProvider();
    try {
        const chainId = await provider.getChainId();
        return JSON.stringify({
            status: 'success',
            chainId,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getChainId = getChainId;
//# sourceMappingURL=getChainId.js.map