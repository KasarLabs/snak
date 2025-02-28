"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTransactionCalls = processTransactionCalls;
function buildTransactionCall(data) {
    if (!data || !data.contractAddress || !data.entrypoint || !data.calldata) {
        return undefined;
    }
    return {
        contract_address: data.contractAddress,
        entry_point: data.entrypoint,
        calldata: data.calldata,
    };
}
async function processTransactionCalls(calls) {
    const validCalls = calls
        .map((call) => {
        const transactionCall = buildTransactionCall(call);
        return transactionCall;
    })
        .filter((call) => call !== undefined);
    if (validCalls.length === 0) {
        throw new Error('No valid transactions found. At least one transaction is required.');
    }
    return validCalls;
}
//# sourceMappingURL=processTransactions.js.map