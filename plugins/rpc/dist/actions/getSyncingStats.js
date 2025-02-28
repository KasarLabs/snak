"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncingStats = void 0;
const getSyncingStats = async (agent) => {
    const provider = agent.getProvider();
    try {
        const syncingStats = await provider.getSyncingStats();
        return JSON.stringify({
            status: 'success',
            syncingStats,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getSyncingStats = getSyncingStats;
//# sourceMappingURL=getSyncingStats.js.map