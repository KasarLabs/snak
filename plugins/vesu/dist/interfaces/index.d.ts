import { z } from 'zod';
import { Hex } from '../utils/num';
export type Address = `0x${string}`;
export declare const addressSchema: z.ZodUnion<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, `0x${string}`, string>, z.ZodLiteral<"0x0">]>;
export interface ITokenValue {
    value: bigint;
    decimals: number;
}
export interface IBaseToken {
    name: string;
    address: Hex;
    symbol: string;
    decimals: number;
    usdPrice?: ITokenValue;
}
export interface IPoolAssetPair {
    collateralAssetAddress: Hex;
    debtAssetAddress: Hex;
    maxLTV: ITokenValue;
}
export interface IPoolAsset extends IBaseToken {
    vToken: IBaseToken;
    listedBlockNumber: number;
    config: {
        debtFloor: ITokenValue;
        isLegacy: boolean;
        feeRate: ITokenValue;
        lastFullUtilizationRate: ITokenValue;
        lastRateAccumulator: ITokenValue;
        lastUpdated: Date;
        maxUtilization: ITokenValue;
        reserve: ITokenValue;
        totalCollateralShares: ITokenValue;
        totalNominalDebt: ITokenValue;
    };
    interestRate: ITokenValue;
    stats: {
        totalSupplied: ITokenValue;
        totalDebt: ITokenValue;
        currentUtilization: ITokenValue;
        supplyApy: ITokenValue;
        defiSpringSupplyApr: ITokenValue | null;
        lstApr: ITokenValue | null;
        borrowApr: ITokenValue;
    };
}
export interface IPool {
    id: string;
    name: string;
    owner: Hex;
    extensionContractAddress: Hex;
    isVerified: boolean;
    assets: IPoolAsset[];
    stats?: {
        usdTotalSupplied: ITokenValue;
        usdTotalBorrowed: ITokenValue;
    };
    pairs?: IPoolAssetPair[];
}
export declare const poolParser: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    owner: z.ZodUnion<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, `0x${string}`, string>, z.ZodLiteral<"0x0">]>;
    extensionContractAddress: z.ZodUnion<[z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, `0x${string}`, string>, z.ZodLiteral<"0x0">]>;
    isVerified: z.ZodBoolean;
    assets: z.ZodAny;
    pairs: z.ZodAny;
}, "strip", z.ZodTypeAny, {
    name: string;
    owner: `0x${string}`;
    id: string;
    extensionContractAddress: `0x${string}`;
    isVerified: boolean;
    assets?: any;
    pairs?: any;
}, {
    name: string;
    owner: string;
    id: string;
    extensionContractAddress: string;
    isVerified: boolean;
    assets?: any;
    pairs?: any;
}>;
export interface DepositParams {
    depositTokenSymbol: string;
    depositAmount: string;
}
export interface WithdrawParams {
    withdrawTokenSymbol: string;
}
export interface BigDecimal {
    value: bigint;
    decimals: number;
}
export interface DepositResult {
    status: 'success' | 'failure';
    amount?: string;
    symbol?: string;
    recipients_address?: string;
    transaction_hash?: string;
    error?: string;
    step?: string;
}
export interface WithdrawResult {
    status: 'success' | 'failure';
    symbol?: string;
    recipients_address?: string;
    transaction_hash?: string;
    error?: string;
    step?: string;
}
