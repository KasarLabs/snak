import z from 'zod';
export declare const contractAddressSchema: z.ZodObject<{
    contractAddress: z.ZodString;
}, "strip", z.ZodTypeAny, {
    contractAddress: string;
}, {
    contractAddress: string;
}>;
export declare const createMemecoinSchema: z.ZodObject<{
    owner: z.ZodString;
    name: z.ZodString;
    symbol: z.ZodString;
    initialSupply: z.ZodString;
    salt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    owner: string;
    name: string;
    initialSupply: string;
    salt?: string | undefined;
}, {
    symbol: string;
    owner: string;
    name: string;
    initialSupply: string;
    salt?: string | undefined;
}>;
export declare const launchOnEkuboSchema: z.ZodObject<{
    launchParams: z.ZodEffects<z.ZodObject<{
        memecoinAddress: z.ZodString;
        transferRestrictionDelay: z.ZodNumber;
        maxPercentageBuyLaunch: z.ZodNumber;
        quoteAddress: z.ZodString;
        initialHolders: z.ZodArray<z.ZodString, "many">;
        initialHoldersAmounts: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        memecoinAddress: string;
        transferRestrictionDelay: number;
        maxPercentageBuyLaunch: number;
        quoteAddress: string;
        initialHolders: string[];
        initialHoldersAmounts: string[];
    }, {
        memecoinAddress: string;
        transferRestrictionDelay: number;
        maxPercentageBuyLaunch: number;
        quoteAddress: string;
        initialHolders: string[];
        initialHoldersAmounts: string[];
    }>, {
        memecoinAddress: string;
        transferRestrictionDelay: number;
        maxPercentageBuyLaunch: number;
        quoteAddress: string;
        initialHolders: string[];
        initialHoldersAmounts: string[];
    }, {
        memecoinAddress: string;
        transferRestrictionDelay: number;
        maxPercentageBuyLaunch: number;
        quoteAddress: string;
        initialHolders: string[];
        initialHoldersAmounts: string[];
    }>;
    ekuboParams: z.ZodObject<{
        fee: z.ZodEffects<z.ZodString, string, string>;
        tickSpacing: z.ZodString;
        startingPrice: z.ZodObject<{
            mag: z.ZodString;
            sign: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            mag: string;
            sign: boolean;
        }, {
            mag: string;
            sign: boolean;
        }>;
        bound: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        fee: string;
        tickSpacing: string;
        startingPrice: {
            mag: string;
            sign: boolean;
        };
        bound: string;
    }, {
        fee: string;
        tickSpacing: string;
        startingPrice: {
            mag: string;
            sign: boolean;
        };
        bound: string;
    }>;
}, "strip", z.ZodTypeAny, {
    launchParams: {
        memecoinAddress: string;
        transferRestrictionDelay: number;
        maxPercentageBuyLaunch: number;
        quoteAddress: string;
        initialHolders: string[];
        initialHoldersAmounts: string[];
    };
    ekuboParams: {
        fee: string;
        tickSpacing: string;
        startingPrice: {
            mag: string;
            sign: boolean;
        };
        bound: string;
    };
}, {
    launchParams: {
        memecoinAddress: string;
        transferRestrictionDelay: number;
        maxPercentageBuyLaunch: number;
        quoteAddress: string;
        initialHolders: string[];
        initialHoldersAmounts: string[];
    };
    ekuboParams: {
        fee: string;
        tickSpacing: string;
        startingPrice: {
            mag: string;
            sign: boolean;
        };
        bound: string;
    };
}>;
export type LaunchOnEkuboParams = z.infer<typeof launchOnEkuboSchema>;
export type CreateMemecoinParams = z.infer<typeof createMemecoinSchema>;
export type ContractAddressParams = z.infer<typeof contractAddressSchema>;
