"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClassAt = void 0;
const getClassAt = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        let blockIdentifier = params.blockId || 'latest';
        if (typeof blockIdentifier === 'string' &&
            !isNaN(Number(blockIdentifier)) &&
            blockIdentifier !== 'latest') {
            blockIdentifier = Number(blockIdentifier);
        }
        const contractClass = await provider.getClassAt(params.contractAddress, blockIdentifier);
        return JSON.stringify({
            status: 'success',
            contractClass,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getClassAt = getClassAt;
//# sourceMappingURL=getClassAt.js.map