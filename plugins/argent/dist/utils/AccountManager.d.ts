import { AccountDetails, BaseUtilityClass, TransactionResult } from '../types/accounts';
export declare class AccountManager implements BaseUtilityClass {
    provider: any;
    constructor(provider: any);
    createAccount(accountClassHash: string): Promise<AccountDetails>;
    deployAccount(accountClassHash: string, accountDetails: AccountDetails): Promise<TransactionResult>;
    estimateAccountDeployFee(accountClassHash: string, accountDetails: AccountDetails): Promise<import("starknet").EstimateFee>;
    getV3DetailsPayload: () => {
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
}
export declare const wrapAccountCreationResponse: (response: string) => string;
