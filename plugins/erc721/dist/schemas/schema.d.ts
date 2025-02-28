import { z } from 'zod';
export declare const getBalanceSchema: z.ZodObject<{
    accountAddress: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    accountAddress: string;
    contractAddress: string;
}, {
    accountAddress: string;
    contractAddress: string;
}>;
export declare const getOwnBalanceSchema: z.ZodObject<{
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
}, {
    contractAddress: string;
}>;
export declare const ownerOfSchema: z.ZodObject<{
    tokenId: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    tokenId: string;
}, {
    contractAddress: string;
    tokenId: string;
}>;
export declare const getApprovedSchema: z.ZodObject<{
    tokenId: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    tokenId: string;
}, {
    contractAddress: string;
    tokenId: string;
}>;
export declare const isApprovedForAllSchema: z.ZodObject<{
    ownerAddress: z.ZodString;
    operatorAddress: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    ownerAddress: string;
    operatorAddress: string;
}, {
    contractAddress: string;
    ownerAddress: string;
    operatorAddress: string;
}>;
export declare const transferFromSchema: z.ZodObject<{
    fromAddress: z.ZodString;
    toAddress: z.ZodString;
    tokenId: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    tokenId: string;
    fromAddress: string;
    toAddress: string;
}, {
    contractAddress: string;
    tokenId: string;
    fromAddress: string;
    toAddress: string;
}>;
export declare const transferSchema: z.ZodObject<{
    toAddress: z.ZodString;
    tokenId: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    tokenId: string;
    toAddress: string;
}, {
    contractAddress: string;
    tokenId: string;
    toAddress: string;
}>;
export declare const safeTransferFromSchema: z.ZodObject<{
    fromAddress: z.ZodString;
    toAddress: z.ZodString;
    tokenId: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    tokenId: string;
    fromAddress: string;
    toAddress: string;
}, {
    contractAddress: string;
    tokenId: string;
    fromAddress: string;
    toAddress: string;
}>;
export declare const approveSchema: z.ZodObject<{
    approvedAddress: z.ZodString;
    tokenId: z.ZodString;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    tokenId: string;
    approvedAddress: string;
}, {
    contractAddress: string;
    tokenId: string;
    approvedAddress: string;
}>;
export declare const setApprovalForAllSchema: z.ZodObject<{
    operatorAddress: z.ZodString;
    approved: z.ZodBoolean;
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
    operatorAddress: string;
    approved: boolean;
}, {
    contractAddress: string;
    operatorAddress: string;
    approved: boolean;
}>;
export declare const deployERC721Schema: z.ZodObject<{
    name: z.ZodString;
    symbol: z.ZodString;
    baseUri: z.ZodString;
    totalSupply: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    baseUri: string;
    totalSupply: string;
}, {
    symbol: string;
    name: string;
    baseUri: string;
    totalSupply: string;
}>;
