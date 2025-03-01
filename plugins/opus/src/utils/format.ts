import { formatUnits } from 'ethers';

/** 10^18 is used for absolute amounts (e.g. balances, debt) */
export const WAD_DECIMALS = 18;

/** 10^27 is used for fractional amounts (e.g. percentages, LTV, interest rates, etc.) */
export const RAY_DECIMALS = 27;

type DecimalTypes = 'wad' | 'ray';

const CASES: Record<DecimalTypes, number> = {
  wad: WAD_DECIMALS,
  ray: RAY_DECIMALS,
} as const;

export function formatValue(
  value: bigint,
  type: DecimalTypes = 'wad',
  decimals?: number
) {
  return formatUnits(value, CASES[type] ?? decimals);
}
