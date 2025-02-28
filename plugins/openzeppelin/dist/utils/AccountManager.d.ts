import { AccountDetails, BaseUtilityClass, TransactionResult } from '../types/accounts';
export declare class AccountManager implements BaseUtilityClass {
    provider: any;
    constructor(provider: any);
    createAccount(accountClassHash: string): Promise<AccountDetails>;
    deployAccount(accountClassHash: string, accountDetails: AccountDetails): Promise<TransactionResult>;
    estimateAccountDeployFee(accountClassHash: string, accountDetails: AccountDetails): Promise<import("starknet").EstimateFee>;
}
export declare const wrapAccountCreationResponse: (response: string) => string;
