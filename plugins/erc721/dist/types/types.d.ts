import { Call, Account } from 'starknet';
export interface TransactionResult {
    status: 'success' | 'failure';
    tokenId?: string;
    from?: string;
    to?: string;
    operator?: string;
    approved?: boolean;
    transactionHash?: string;
    error?: string;
    step?: string;
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
