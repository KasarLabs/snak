"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTools = void 0;
const schemas_1 = require("../schemas");
const openTrove_1 = require("../actions/openTrove");
const getters_1 = require("../actions/getters");
const depositTrove_1 = require("../actions/depositTrove");
const withdrawTrove_1 = require("../actions/withdrawTrove");
const borrowTrove_1 = require("../actions/borrowTrove");
const repayTrove_1 = require("../actions/repayTrove");
const registerTools = (StarknetToolRegistry) => {
    StarknetToolRegistry.push({
        name: 'open_trove',
        plugins: 'opus',
        description: 'Open a Trove on Opus',
        schema: schemas_1.openTroveSchema,
        execute: openTrove_1.openTrove,
    });
    StarknetToolRegistry.push({
        name: 'get_user_troves',
        plugins: 'opus',
        description: 'Get trove IDs for an address on Opus',
        schema: schemas_1.getUserTrovesSchema,
        execute: getters_1.getUserTroves,
    });
    StarknetToolRegistry.push({
        name: 'get_trove_health',
        plugins: 'opus',
        description: 'Get the health of a trove on Opus',
        schema: schemas_1.getTroveHealthSchema,
        execute: getters_1.getTroveHealth,
    });
    StarknetToolRegistry.push({
        name: 'get_borrow_fee',
        plugins: 'opus',
        description: 'Get the current borrow fee for Opus',
        execute: getters_1.getBorrowFee,
    });
    StarknetToolRegistry.push({
        name: 'deposit_trove',
        plugins: 'opus',
        description: 'Deposit collateral to a Trove on Opus',
        schema: schemas_1.collateralActionSchema,
        execute: depositTrove_1.depositTrove,
    });
    StarknetToolRegistry.push({
        name: 'withdraw_trove',
        plugins: 'opus',
        description: 'Withdraw collateral from a Trove on Opus',
        schema: schemas_1.collateralActionSchema,
        execute: withdrawTrove_1.withdrawTrove,
    });
    StarknetToolRegistry.push({
        name: 'borrow_trove',
        plugins: 'opus',
        description: 'Borrow CASH for a Trove on Opus',
        schema: schemas_1.borrowTroveSchema,
        execute: borrowTrove_1.borrowTrove,
    });
    StarknetToolRegistry.push({
        name: 'repay_trove',
        plugins: 'opus',
        description: 'Repay CASH for a Trove on Opus',
        schema: schemas_1.repayTroveSchema,
        execute: repayTrove_1.repayTrove,
    });
};
exports.registerTools = registerTools;
//# sourceMappingURL=index.js.map