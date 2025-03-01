import { z } from 'zod';
export declare const accountDetailsSchema: z.ZodObject<{
    contractAddress: z.ZodString;
    publicKey: z.ZodString;
    privateKey: z.ZodString;
}, "strip", z.ZodTypeAny, {
    publicKey: string;
    contractAddress: string;
    privateKey: string;
}, {
    publicKey: string;
    contractAddress: string;
    privateKey: string;
}>;
