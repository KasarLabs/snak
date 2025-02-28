import { Token as AvnuToken } from '@avnu/avnu-sdk';
export interface SwapParams {
    sellTokenSymbol: string;
    buyTokenSymbol: string;
    sellAmount: number;
}
export interface Token {
    name: string;
    address: string;
    symbol: string;
    decimals: number;
    logoUri: string | null;
    lastDailyVolumeUsd: number;
    extensions: {
        [key: string]: string;
    };
    tags: string[];
}
export interface TokenResponse {
    content: AvnuToken[];
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
}
export interface SwapResult {
    status: 'success' | 'failure';
    message?: string;
    error?: string;
    transactionHash?: string;
    sellAmount?: number;
    sellToken?: string;
    buyToken?: string;
    amountReceived?: string;
    receipt?: any;
    events?: any[];
}
