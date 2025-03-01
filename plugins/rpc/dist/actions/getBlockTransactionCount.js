"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockTransactionCount = void 0;
const getBlockTransactionCount = async (agent, params) => {
    const provider = agent.getProvider();
    return await provider.getBlockTransactionCount(params.blockId);
};
exports.getBlockTransactionCount = getBlockTransactionCount;
//# sourceMappingURL=getBlockTransactionCount.js.map