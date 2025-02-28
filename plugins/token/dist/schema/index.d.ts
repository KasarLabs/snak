import { z } from 'zod';
export declare const Transferschema: z.ZodObject<{
    recipient_address: z.ZodString;
    amount: z.ZodString;
    symbol: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    recipient_address: string;
    amount: string;
}, {
    symbol: string;
    recipient_address: string;
    amount: string;
}>;
export declare const getOwnBalanceSchema: z.ZodObject<{
    symbol: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
}, {
    symbol: string;
}>;
export declare const getBalanceSchema: z.ZodObject<{
    walletAddress: z.ZodString;
    assetSymbol: z.ZodString;
}, "strip", z.ZodTypeAny, {
    walletAddress: string;
    assetSymbol: string;
}, {
    walletAddress: string;
    assetSymbol: string;
}>;
export declare const transferSignatureschema: z.ZodObject<{
    payloads: z.ZodArray<z.ZodObject<{
        recipient_address: z.ZodString;
        amount: z.ZodString;
        symbol: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        recipient_address: string;
        amount: string;
    }, {
        symbol: string;
        recipient_address: string;
        amount: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    payloads: {
        symbol: string;
        recipient_address: string;
        amount: string;
    }[];
}, {
    payloads: {
        symbol: string;
        recipient_address: string;
        amount: string;
    }[];
}>;
