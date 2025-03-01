import { SimulateTransactionResponse } from 'starknet';
export declare const TransactionReponseFormat: (transactionResponse: SimulateTransactionResponse) => {
    transaction_number: number;
    fee_estimation: {
        title: string;
        details: {
            gas_consumed: string;
            gas_price: string;
            overall_fee: string;
            unit: "WEI" | "FRI";
            data_gas_consumed?: string | undefined;
            data_gas_price?: string | undefined;
        };
    };
    resource_bounds: {
        l1_gas: {
            max_amount: string;
            max_price_per_unit: string;
        };
        l2_gas: {
            max_amount: string;
            max_price_per_unit: string;
        };
    };
    suggested_max_fee: string;
}[];
