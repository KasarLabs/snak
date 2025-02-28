"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBorrowFee = exports.getTroveHealth = exports.getUserTroves = void 0;
const troveManager_1 = require("../utils/troveManager");
const getUserTroves = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const TroveManager = (0, troveManager_1.createTroveManager)(agent, accountAddress);
        const result = await TroveManager.getUserTroves(params);
        return JSON.stringify({
            status: 'success',
            data: result,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getUserTroves = getUserTroves;
const getTroveHealth = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const troveManager = (0, troveManager_1.createTroveManager)(agent, accountAddress);
        const result = await troveManager.getTroveHealth(params);
        return JSON.stringify({
            status: 'success',
            data: result,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTroveHealth = getTroveHealth;
const getBorrowFee = async (agent) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const TroveManager = (0, troveManager_1.createTroveManager)(agent, accountAddress);
        const result = await TroveManager.getBorrowFee();
        return JSON.stringify({
            status: 'success',
            data: result,
        });
    }
    catch (error) {
        return JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getBorrowFee = getBorrowFee;
//# sourceMappingURL=getters.js.map