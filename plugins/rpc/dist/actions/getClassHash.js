"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassHashAt = void 0;
const getClassHashAt = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        let blockIdentifier = params.blockId || 'latest';
        if (typeof blockIdentifier === 'string' &&
            !isNaN(Number(blockIdentifier)) &&
            blockIdentifier !== 'latest') {
            blockIdentifier = Number(blockIdentifier);
        }
        const classHash = await provider.getClassHashAt(params.contractAddress, blockIdentifier);
        return JSON.stringify({
            status: 'success',
            classHash,
        });
    }
    catch (error) {
        console.error('GetClassHash error:', error);
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getClassHashAt = getClassHashAt;
//# sourceMappingURL=getClassHash.js.map