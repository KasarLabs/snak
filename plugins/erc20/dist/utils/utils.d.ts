import { Provider } from 'starknet';
import { ParamsValidationResult, ExecuteV3Args } from '../types/types';
import { validToken } from '../types/types';
export declare const getTokenDecimals: (symbol: string) => number;
export declare const formatBalance: (rawBalance: bigint | string | number, decimals: number) => string;
export declare const validateTokenAddress: (symbol: string) => string;
export declare const formatTokenAmount: (amount: string, decimals: number) => string;
export declare const validateAndFormatParams: (address: string, amount: string, decimals: number) => ParamsValidationResult;
export declare const getV3DetailsPayload: () => {
    version: number;
    maxFee: bigint;
    feeDataAvailabilityMode: any;
    tip: bigint;
    paymasterData: never[];
    resourceBounds: {
        l1_gas: {
            max_amount: string;
            max_price_per_unit: string;
        };
        l2_gas: {
            max_amount: string;
            max_price_per_unit: string;
        };
    };
};
export declare const executeV3Transaction: ({ call, account, }: ExecuteV3Args) => Promise<string>;
export declare function validateToken(provider: Provider, assetSymbol?: string, assetAddress?: string): Promise<validToken>;
