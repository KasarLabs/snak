import { z } from 'zod';
export declare const Transferschema: z.ZodObject<{
    recipient_address: z.ZodString;
    amount: z.ZodString;
    symbol: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    amount: string;
    recipient_address: string;
}, {
    symbol: string;
    amount: string;
    recipient_address: string;
}>;
export declare const transferSignatureschema: z.ZodObject<{
    payloads: z.ZodArray<z.ZodObject<{
        recipient_address: z.ZodString;
        amount: z.ZodString;
        symbol: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        amount: string;
        recipient_address: string;
    }, {
        symbol: string;
        amount: string;
        recipient_address: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    payloads: {
        symbol: string;
        amount: string;
        recipient_address: string;
    }[];
}, {
    payloads: {
        symbol: string;
        amount: string;
        recipient_address: string;
    }[];
}>;
export declare const DeployArgentAccountSignatureSchema: z.ZodObject<{
    publicKeyAX: z.ZodString;
    privateKeyAX: z.ZodString;
}, "strip", z.ZodTypeAny, {
    publicKeyAX: string;
    privateKeyAX: string;
}, {
    publicKeyAX: string;
    privateKeyAX: string;
}>;
export declare const getBalanceSignatureSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    assetSymbol: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    assetSymbol: string;
}, {
    accountAddress: string;
    assetSymbol: string;
}>;
