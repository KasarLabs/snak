import { z } from 'zod';
export declare const depositEarnSchema: z.ZodObject<{
    depositTokenSymbol: z.ZodString;
    depositAmount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    depositTokenSymbol: string;
    depositAmount: string;
}, {
    depositTokenSymbol: string;
    depositAmount: string;
}>;
export declare const withdrawEarnSchema: z.ZodObject<{
    withdrawTokenSymbol: z.ZodString;
}, "strip", z.ZodTypeAny, {
    withdrawTokenSymbol: string;
}, {
    withdrawTokenSymbol: string;
}>;
