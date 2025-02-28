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
export declare const batchSwapSchema: z.ZodObject<{
    sellTokenSymbols: z.ZodArray<z.ZodString, "many">;
    buyTokenSymbol: z.ZodString;
    sellAmounts: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    buyTokenSymbol: string;
    sellTokenSymbols: string[];
    sellAmounts: number[];
}, {
    buyTokenSymbol: string;
    sellTokenSymbols: string[];
    sellAmounts: number[];
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
export type RouteSchemaType = z.infer<typeof routeSchema>;
