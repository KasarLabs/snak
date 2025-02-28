import { z } from 'zod';
export declare const GetProofServiceSchema: z.ZodObject<{
    filename: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
}, {
    filename: string;
}>;
export declare const VerifyProofServiceSchema: z.ZodObject<{
    filename: z.ZodString;
    memoryVerification: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
    memoryVerification: string;
}, {
    filename: string;
    memoryVerification: string;
}>;
