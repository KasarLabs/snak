import { z } from 'zod';
export declare const valSchema: z.ZodEffects<z.ZodObject<{
    val: z.ZodBigInt;
}, "strip", z.ZodTypeAny, {
    val: bigint;
}, {
    val: bigint;
}>, bigint, {
    val: bigint;
}>;
export declare function transformVal(val: {
    val: bigint;
}): bigint;
export declare const wadSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    val: z.ZodBigInt;
}, "strip", z.ZodTypeAny, {
    val: bigint;
}, {
    val: bigint;
}>, bigint, {
    val: bigint;
}>, {
    value: bigint;
    formatted: string;
}, {
    val: bigint;
}>;
export type Wad = z.infer<typeof wadSchema>;
export declare const raySchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    val: z.ZodBigInt;
}, "strip", z.ZodTypeAny, {
    val: bigint;
}, {
    val: bigint;
}>, bigint, {
    val: bigint;
}>, {
    value: bigint;
    formatted: string;
}, {
    val: bigint;
}>;
export type Ray = z.infer<typeof raySchema>;
export declare const assetBalanceInputSchema: z.ZodObject<{
    symbol: z.ZodString;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    amount: string;
}, {
    symbol: string;
    amount: string;
}>;
export declare const assetBalancesInputSchema: z.ZodArray<z.ZodObject<{
    symbol: z.ZodString;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    amount: string;
}, {
    symbol: string;
    amount: string;
}>, "many">;
export type AssetBalanceInput = z.infer<typeof assetBalanceInputSchema>;
export type AssetBalancesInput = z.infer<typeof assetBalancesInputSchema>;
export declare const assetBalanceSchema: z.ZodObject<{
    address: z.ZodString;
    amount: z.ZodBigInt;
}, "strip", z.ZodTypeAny, {
    amount: bigint;
    address: string;
}, {
    amount: bigint;
    address: string;
}>;
export declare const assetBalancesSchema: z.ZodArray<z.ZodObject<{
    address: z.ZodString;
    amount: z.ZodBigInt;
}, "strip", z.ZodTypeAny, {
    amount: bigint;
    address: string;
}, {
    amount: bigint;
    address: string;
}>, "many">;
export type AssetBalance = z.infer<typeof assetBalanceSchema>;
export type AssetBalances = z.infer<typeof assetBalancesSchema>;
export declare const healthSchema: z.ZodObject<{
    debt: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        val: z.ZodBigInt;
    }, "strip", z.ZodTypeAny, {
        val: bigint;
    }, {
        val: bigint;
    }>, bigint, {
        val: bigint;
    }>, {
        value: bigint;
        formatted: string;
    }, {
        val: bigint;
    }>;
    value: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        val: z.ZodBigInt;
    }, "strip", z.ZodTypeAny, {
        val: bigint;
    }, {
        val: bigint;
    }>, bigint, {
        val: bigint;
    }>, {
        value: bigint;
        formatted: string;
    }, {
        val: bigint;
    }>;
    ltv: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        val: z.ZodBigInt;
    }, "strip", z.ZodTypeAny, {
        val: bigint;
    }, {
        val: bigint;
    }>, bigint, {
        val: bigint;
    }>, {
        value: bigint;
        formatted: string;
    }, {
        val: bigint;
    }>;
    threshold: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        val: z.ZodBigInt;
    }, "strip", z.ZodTypeAny, {
        val: bigint;
    }, {
        val: bigint;
    }>, bigint, {
        val: bigint;
    }>, {
        value: bigint;
        formatted: string;
    }, {
        val: bigint;
    }>;
}, "strip", z.ZodTypeAny, {
    value: {
        value: bigint;
        formatted: string;
    };
    debt: {
        value: bigint;
        formatted: string;
    };
    ltv: {
        value: bigint;
        formatted: string;
    };
    threshold: {
        value: bigint;
        formatted: string;
    };
}, {
    value: {
        val: bigint;
    };
    debt: {
        val: bigint;
    };
    ltv: {
        val: bigint;
    };
    threshold: {
        val: bigint;
    };
}>;
export type Health = z.infer<typeof healthSchema>;
export declare const getUserTrovesSchema: z.ZodObject<{
    user: z.ZodString;
}, "strip", z.ZodTypeAny, {
    user: string;
}, {
    user: string;
}>;
export type GetUserTrovesParams = z.infer<typeof getUserTrovesSchema>;
export declare const getTroveHealthSchema: z.ZodObject<{
    troveId: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    troveId: number;
}, {
    troveId: number;
}>;
export type GetTroveHealthParams = z.infer<typeof getTroveHealthSchema>;
export declare const openTroveSchema: z.ZodObject<{
    collaterals: z.ZodArray<z.ZodObject<{
        symbol: z.ZodString;
        amount: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        amount: string;
    }, {
        symbol: string;
        amount: string;
    }>, "many">;
    borrowAmount: z.ZodString;
    maxBorrowFeePct: z.ZodString;
}, "strip", z.ZodTypeAny, {
    collaterals: {
        symbol: string;
        amount: string;
    }[];
    borrowAmount: string;
    maxBorrowFeePct: string;
}, {
    collaterals: {
        symbol: string;
        amount: string;
    }[];
    borrowAmount: string;
    maxBorrowFeePct: string;
}>;
export type OpenTroveParams = z.infer<typeof openTroveSchema>;
export declare const collateralActionSchema: z.ZodObject<{
    troveId: z.ZodNumber;
    collateral: z.ZodObject<{
        symbol: z.ZodString;
        amount: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        symbol: string;
        amount: string;
    }, {
        symbol: string;
        amount: string;
    }>;
}, "strip", z.ZodTypeAny, {
    troveId: number;
    collateral: {
        symbol: string;
        amount: string;
    };
}, {
    troveId: number;
    collateral: {
        symbol: string;
        amount: string;
    };
}>;
export type DepositTroveParams = z.infer<typeof collateralActionSchema>;
export type WithdrawTroveParams = z.infer<typeof collateralActionSchema>;
export declare const borrowTroveSchema: z.ZodObject<{
    troveId: z.ZodNumber;
    amount: z.ZodString;
    maxBorrowFeePct: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: string;
    troveId: number;
    maxBorrowFeePct: string;
}, {
    amount: string;
    troveId: number;
    maxBorrowFeePct: string;
}>;
export type BorrowTroveParams = z.infer<typeof borrowTroveSchema>;
export declare const repayTroveSchema: z.ZodObject<{
    troveId: z.ZodNumber;
    amount: z.ZodString;
}, "strip", z.ZodTypeAny, {
    amount: string;
    troveId: number;
}, {
    amount: string;
    troveId: number;
}>;
export type RepayTroveParams = z.infer<typeof repayTroveSchema>;
export declare const troveOpenedEventSchema: z.ZodObject<{
    user: z.ZodBigInt;
    trove_id: z.ZodBigInt;
}, "strip", z.ZodTypeAny, {
    user: bigint;
    trove_id: bigint;
}, {
    user: bigint;
    trove_id: bigint;
}>;
export declare const forgeFeePaidEventSchema: z.ZodObject<{
    trove_id: z.ZodBigInt;
    fee: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        val: z.ZodBigInt;
    }, "strip", z.ZodTypeAny, {
        val: bigint;
    }, {
        val: bigint;
    }>, bigint, {
        val: bigint;
    }>, {
        value: bigint;
        formatted: string;
    }, {
        val: bigint;
    }>;
    fee_pct: z.ZodEffects<z.ZodEffects<z.ZodObject<{
        val: z.ZodBigInt;
    }, "strip", z.ZodTypeAny, {
        val: bigint;
    }, {
        val: bigint;
    }>, bigint, {
        val: bigint;
    }>, {
        value: bigint;
        formatted: string;
    }, {
        val: bigint;
    }>;
}, "strip", z.ZodTypeAny, {
    trove_id: bigint;
    fee: {
        value: bigint;
        formatted: string;
    };
    fee_pct: {
        value: bigint;
        formatted: string;
    };
}, {
    trove_id: bigint;
    fee: {
        val: bigint;
    };
    fee_pct: {
        val: bigint;
    };
}>;
