"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClass = void 0;
const getClass = async (agent, params) => {
    const provider = agent.getProvider();
    try {
        let blockIdentifier = params.blockId || 'latest';
        if (typeof blockIdentifier === 'string' &&
            !isNaN(Number(blockIdentifier)) &&
            blockIdentifier !== 'latest') {
            blockIdentifier = Number(blockIdentifier);
        }
        const contractClass = await provider.getClass(params.contractAddress, blockIdentifier);
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
exports.getClass = getClass;
//# sourceMappingURL=getClass.js.map