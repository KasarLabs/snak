import z from 'zod';
export declare const swapSchema: z.ZodObject<{
    sellTokenSymbol: z.ZodString;
    buyTokenSymbol: z.ZodString;
    sellAmount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sellTokenSymbol: string;
    buyTokenSymbol: string;
    sellAmount: number;
}, {
    sellTokenSymbol: string;
    buyTokenSymbol: string;
    sellAmount: number;
}>;
export declare const routeSchema: z.ZodObject<{
    sellTokenSymbol: z.ZodString;
    buyTokenSymbol: z.ZodString;
    sellAmount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sellTokenSymbol: string;
    buyTokenSymbol: string;
    sellAmount: number;
}, {
    sellTokenSymbol: string;
    buyTokenSymbol: string;
    sellAmount: number;
}>;
