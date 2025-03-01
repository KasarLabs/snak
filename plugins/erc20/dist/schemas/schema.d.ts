import { z } from 'zod';
export declare const getAllowanceSchema: z.ZodObject<{
    ownerAddress: z.ZodString;
    spenderAddress: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ownerAddress: string;
    spenderAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    ownerAddress: string;
    spenderAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const getMyGivenAllowanceSchema: z.ZodObject<{
    spenderAddress: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    spenderAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    spenderAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const getAllowanceGivenToMeSchema: z.ZodObject<{
    ownerAddress: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ownerAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    ownerAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const getTotalSupplySchema: z.ZodObject<{
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const transferFromSchema: z.ZodObject<{
    fromAddress: z.ZodString;
    toAddress: z.ZodString;
    amount: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fromAddress: string;
    toAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    fromAddress: string;
    toAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const transferFromSignatureSchema: z.ZodObject<{
    fromAddress: z.ZodString;
    toAddress: z.ZodString;
    amount: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fromAddress: string;
    toAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    fromAddress: string;
    toAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const getBalanceSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    accountAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const getOwnBalanceSchema: z.ZodObject<{
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const getBalanceSignatureSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    accountAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const approveSchema: z.ZodObject<{
    spenderAddress: z.ZodString;
    amount: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    spenderAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    spenderAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const approveSignatureSchema: z.ZodObject<{
    spenderAddress: z.ZodString;
    amount: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    spenderAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    spenderAddress: string;
    amount: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const transferSchema: z.ZodObject<{
    recipientAddress: z.ZodString;
    amount: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: string;
    recipientAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    amount: string;
    recipientAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const transferSignatureSchema: z.ZodObject<{
    recipientAddress: z.ZodString;
    amount: z.ZodString;
    assetSymbol: z.ZodOptional<z.ZodString>;
    assetAddress: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount: string;
    recipientAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}, {
    amount: string;
    recipientAddress: string;
    assetSymbol?: string | undefined;
    assetAddress?: string | undefined;
}>;
export declare const deployERC20Schema: z.ZodObject<{
    name: z.ZodString;
    symbol: z.ZodString;
    totalSupply: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    totalSupply: string;
}, {
    symbol: string;
    name: string;
    totalSupply: string;
}>;
