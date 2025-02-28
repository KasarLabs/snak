"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.borrowTrove = void 0;
const troveManager_1 = require("../utils/troveManager");
const borrowTrove = async (agent, params) => {
    const accountAddress = agent.getAccountCredentials()?.accountPublicKey;
    try {
        const troveManager = (0, troveManager_1.createTroveManager)(agent, accountAddress);
        const result = await troveManager.borrowTransaction(params, agent);
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
exports.borrowTrove = borrowTrove;
//# sourceMappingURL=borrowTrove.js.map