"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionReponseFormat = void 0;
const TransactionReponseFormat = (transactionResponse) => {
    const transactionDetails = transactionResponse.map((transaction, index) => {
        const feeData = transaction.fee_estimation;
        const resourceBounds = transaction.resourceBounds;
        return {
            transaction_number: index + 1,
            fee_estimation: {
                title: 'Fee Estimation Breakdown',
                details: {
                    ...feeData,
                },
            },
            resource_bounds: {
                l1_gas: {
                    max_amount: resourceBounds.l1_gas.max_amount,
                    max_price_per_unit: resourceBounds.l1_gas.max_price_per_unit,
                },
                l2_gas: {
                    max_amount: resourceBounds.l2_gas.max_amount,
                    max_price_per_unit: resourceBounds.l2_gas.max_price_per_unit,
                },
            },
            suggested_max_fee: transaction.suggestedMaxFee.toString(),
        };
    });
    return transactionDetails;
};
exports.TransactionReponseFormat = TransactionReponseFormat;
//# sourceMappingURL=outputSimulateTransaction.js.map