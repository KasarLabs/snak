import { RpcProvider, BigNumberish } from 'starknet';
import { AccountDetails, BaseUtilityClass, TransactionResult } from '../types/accounts';
export declare class AccountManager implements BaseUtilityClass {
    provider: RpcProvider;
    initialClassHash: string;
    proxyClassHash: string;
    accountClassHash: string;
    constructor(provider: RpcProvider, initialClassHash: string, proxyClassHash: string, accountClassHash: string);
    createAccount(): Promise<AccountDetails>;
    estimateAccountDeployFee(accountDetails: AccountDetails): Promise<bigint>;
    deployAccount(accountDetails: AccountDetails, maxFee?: BigNumberish): Promise<TransactionResult>;
    private calcInit;
    private getProxyConstructor;
    private getBraavosSignature;
}
export declare const wrapAccountCreationResponse: (response: string) => string;
