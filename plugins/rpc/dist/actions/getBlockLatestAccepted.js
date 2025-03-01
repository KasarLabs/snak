"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockLatestAccepted = void 0;
const getBlockLatestAccepted = async (agent) => {
    const provider = agent.getProvider();
    try {
        const blockHashAndNumber = await provider.getBlockLatestAccepted();
        return JSON.stringify({
            status: 'success',
            blockHashAndNumber,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getBlockLatestAccepted = getBlockLatestAccepted;
//# sourceMappingURL=getBlockLatestAccepted.js.map