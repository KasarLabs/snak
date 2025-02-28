"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSpecVersion = void 0;
const getSpecVersion = async (agent) => {
    try {
        const provider = agent.getProvider();
        const specVersion = await provider.getSpecVersion();
        return JSON.stringify({
            status: 'success',
            specVersion: specVersion.toString(),
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'failure',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getSpecVersion = getSpecVersion;
//# sourceMappingURL=getSpecVersion.js.map