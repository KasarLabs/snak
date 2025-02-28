import { ExecuteV3Args } from '../types/types';
export declare const bigintToHex: (addressAsBigInt: bigint) => string;
export declare const validateAndFormatTokenId: (tokenId: string) => import("starknet").Uint256;
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
