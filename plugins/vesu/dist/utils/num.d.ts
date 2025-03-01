import { Uint256, BigNumberish as StarknetBigNumberish } from 'starknet';
import { z } from 'zod';
export declare const SCALE: bigint;
export type Hex = `0x${string}`;
export declare const hexSchemaBase: z.ZodString;
export declare const hexSchema: z.ZodEffects<z.ZodString, `0x${string}`, string>;
export declare function toHex(value: BigNumberish): Hex;
export declare function isEqualHex(a?: Hex, b?: Hex): boolean;
export declare function toNumber(value: BigNumberish): number;
export type BigNumberish = StarknetBigNumberish | Uint256;
export declare function toBN(value: BigNumberish): bigint;
export declare const BigNumberishSchema: z.ZodUnion<[z.ZodLazy<z.ZodEffects<z.ZodEffects<z.ZodString, `0x${string}`, string>, bigint, string>>, z.ZodEffects<z.ZodNumber, bigint, number>, z.ZodEffects<z.ZodString, bigint, string>, z.ZodBigInt]>;
export type U256 = Uint256;
declare const u256Schema: z.ZodObject<{
    low: z.ZodUnion<[z.ZodLazy<z.ZodEffects<z.ZodEffects<z.ZodString, `0x${string}`, string>, bigint, string>>, z.ZodEffects<z.ZodNumber, bigint, number>, z.ZodEffects<z.ZodString, bigint, string>, z.ZodBigInt]>;
    high: z.ZodUnion<[z.ZodLazy<z.ZodEffects<z.ZodEffects<z.ZodString, `0x${string}`, string>, bigint, string>>, z.ZodEffects<z.ZodNumber, bigint, number>, z.ZodEffects<z.ZodString, bigint, string>, z.ZodBigInt]>;
}, "strip", z.ZodTypeAny, {
    low: bigint;
    high: bigint;
}, {
    low: string | number | bigint;
    high: string | number | bigint;
}>;
export type SafeU256 = z.infer<typeof u256Schema>;
export declare function isU256(value: unknown): value is U256;
export declare function toU256(value: BigNumberish): SafeU256;
export type I257<Abs extends BigNumberish = bigint> = {
    abs: Abs;
    is_negative: boolean;
};
export declare function toI257(x: BigNumberish): I257;
export declare function fromI257(x: I257<BigNumberish>): bigint;
export {};
