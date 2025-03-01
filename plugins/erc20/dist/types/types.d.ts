import { Uint256, Call, Account } from 'starknet';
export declare const DECIMALS: {
    USDC: number;
    USDT: number;
    DEFAULT: number;
};
export interface TransferResult {
    status: 'success' | 'failure';
    amount?: string;
    symbol?: string;
    recipients_address?: string;
    transaction_hash?: string;
    error?: string;
    step?: string;
}
export interface validToken {
    address: string;
    symbol: string;
    decimals: number;
}
export interface ParamsValidationResult {
    address: string;
    amount: Uint256;
}
export interface ExecuteV3Args {
    call: Call;
    account: Account;
}
export interface ContractDeclareResult {
    transactionHash: string | undefined;
    classHash: string | undefined;
}
export interface ContractDeployResult {
    transactionHash: string | undefined;
    contractAddress: string | undefined;
}
export interface ContractDeclareAndDeployResult {
    declare: ContractDeclareResult;
    deploy: ContractDeployResult;
}
