"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassHashAt = void 0;
const getClassHashAt = async (agent, params) => {
    try {
        const provider = agent.getProvider();
        const classHash = await provider.getClassHashAt(params.contractAddress, params.blockId);
        return JSON.stringify({
            status: 'success',
            classHash,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getClassHashAt = getClassHashAt;
//# sourceMappingURL=getClassHashAt.js.map