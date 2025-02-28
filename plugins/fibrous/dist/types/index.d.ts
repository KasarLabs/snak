import { BigNumber } from '@ethersproject/bignumber';
export interface SwapParams {
    sellTokenSymbol: string;
    buyTokenSymbol: string;
    sellAmount: number;
}
export interface BatchSwapParams {
    sellTokenSymbols: string[];
    buyTokenSymbols: string[];
    sellAmounts: number[] | BigNumber[];
}
export interface Token {
    name: string;
    address: string;
    symbol: string;
    decimals: number;
    logoUri: string | null;
    volume: string;
    price: string;
    verified: boolean;
    category: string;
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
