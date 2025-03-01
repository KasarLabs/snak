import z from 'zod';
export declare const contractAddressSchema: z.ZodObject<{
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
}, {
    contractAddress: string;
}>;
export declare const blockIdSchema: z.ZodObject<{
    blockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, "strip", z.ZodTypeAny, {
    blockId: string | number;
}, {
    blockId: string | number;
}>;
export declare const blockIdAndContractAddressSchema: z.ZodObject<z.objectUtil.extendShape<{
    blockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    contractAddress: z.ZodString;
}>, "strict", z.ZodTypeAny, {
    contractAddress: string;
    blockId: string | number;
}, {
    contractAddress: string;
    blockId: string | number;
}>;
export declare const getStorageAtSchema: z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    blockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    contractAddress: z.ZodString;
}>, {
    key: z.ZodString;
}>, "strip", z.ZodTypeAny, {
    contractAddress: string;
    blockId: string | number;
    key: string;
}, {
    contractAddress: string;
    blockId: string | number;
    key: string;
}>;
export declare const getClassAtSchema: z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    blockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    contractAddress: z.ZodString;
}>, {
    key: z.ZodString;
}>, "strip", z.ZodTypeAny, {
    contractAddress: string;
    blockId: string | number;
    key: string;
}, {
    contractAddress: string;
    blockId: string | number;
    key: string;
}>;
export declare const getClassHashAtSchema: z.ZodObject<z.objectUtil.extendShape<z.objectUtil.extendShape<{
    blockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    contractAddress: z.ZodString;
}>, {
    key: z.ZodString;
}>, "strip", z.ZodTypeAny, {
    contractAddress: string;
    blockId: string | number;
    key: string;
}, {
    contractAddress: string;
    blockId: string | number;
    key: string;
}>;
export declare const getTransactionByBlockIdAndIndexSchema: z.ZodObject<z.objectUtil.extendShape<{
    blockId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, {
    transactionIndex: z.ZodNumber;
}>, "strip", z.ZodTypeAny, {
    blockId: string | number;
    transactionIndex: number;
}, {
    blockId: string | number;
    transactionIndex: number;
}>;
export declare const transactionHashSchema: z.ZodObject<{
    transactionHash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    transactionHash: string;
}, {
    transactionHash: string;
}>;
export type GetStorageParams = z.infer<typeof getStorageAtSchema>;
export type GetClassAtParams = z.infer<typeof getClassAtSchema>;
export type BlockIdParams = z.infer<typeof blockIdSchema>;
export type BlockIdAndContractAddressParams = z.infer<typeof blockIdAndContractAddressSchema>;
export type GetTransactionByBlockIdAndIndexParams = z.infer<typeof getTransactionByBlockIdAndIndexSchema>;
export type ContractAddressParams = z.infer<typeof contractAddressSchema>;
export type TransactionHashParams = z.infer<typeof transactionHashSchema>;
