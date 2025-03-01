import {
  num,
  Uint256,
  uint256,
  BigNumberish as StarknetBigNumberish,
} from 'starknet';
import { z } from 'zod';

// constants
export const SCALE = 10n ** 18n;

// Hex
export type Hex = `0x${string}`;
export const hexSchemaBase = z
  .string()
  .regex(/^0x[a-fA-F0-9]+$/, 'Hex must be a hex string starting with 0x');
export const hexSchema = hexSchemaBase.transform((v) => v as Hex);

export function toHex(value: BigNumberish): Hex {
  return hexSchema.parse(`0x${toBN(value).toString(16)}`);
}

export function isEqualHex(a?: Hex, b?: Hex) {
  if (!a || !b) return false;
  return toBN(a) === toBN(b);
}

// Number
export function toNumber(value: BigNumberish): number {
  const bn = toBN(value);
  // make sure it's in range of JS number
  if (bn < Number.MIN_SAFE_INTEGER || bn > Number.MAX_SAFE_INTEGER) {
    throw new Error(`Number out of range: ${bn}`);
  }
  return Number(bn);
}

// BN
export type BigNumberish = StarknetBigNumberish | Uint256;
export function toBN(value: BigNumberish): bigint {
  return isU256(value) ? uint256.uint256ToBN(value) : num.toBigInt(value);
}

const decimalSchema = z.string().regex(/^\d+(\.\d+)?$/);
export const BigNumberishSchema = z.union([
  z.lazy(() => hexSchema.transform(toBN)),
  z.number().transform(toBN),
  decimalSchema.transform(toBN),
  z.bigint(),
]);

// U256
export type U256 = Uint256;
const u256Schema = z.object({
  low: BigNumberishSchema,
  high: BigNumberishSchema,
});
export type SafeU256 = z.infer<typeof u256Schema>;
export function isU256(value: unknown): value is U256 {
  return u256Schema.safeParse(value).success;
}
export function toU256(value: BigNumberish): SafeU256 {
  if (isU256(value)) {
    const { low, high } = value;
    return { low: toBN(low), high: toBN(high) };
  }
  const { low, high } = uint256.bnToUint256(toBN(value));
  return { low: toBN(low), high: toBN(high) };
}

// I257 - please dont use anywhere but with the contract
export type I257<Abs extends BigNumberish = bigint> = {
  abs: Abs;
  is_negative: boolean;
};
export function toI257(x: BigNumberish): I257 {
  const bn = toBN(x);
  if (bn < 0n) {
    return { abs: -bn, is_negative: true };
  }
  return { abs: bn, is_negative: false };
}

export function fromI257(x: I257<BigNumberish>): bigint {
  const abs = toBN(x.abs);
  return x.is_negative ? -abs : abs;
}
