import { Call } from '@starknet-io/types-js';
export declare function processTransactionCalls(calls: Array<{
    contractAddress?: string;
    entrypoint?: string;
    calldata?: any[];
}>): Promise<Call[]>;
