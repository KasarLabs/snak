import { z } from 'zod';
import { formatValue } from '../utils/format';

// Wadray types

/**
 * Base schema for Wad and Ray structs with a `val` member of bigint property
 */
export const valSchema = z.object({ val: z.bigint() }).transform(transformVal);

/**
 * Transforms a value object into its bigint value
 * @param {Object} val - Object containing bigint value
 * @param {bigint} val.val - The bigint value
 * @returns {bigint} The extracted bigint value
 */
export function transformVal(val: { val: bigint }) {
  return val.val;
}

/**
 * Schema for Wad values (18 decimal fixed-point numbers)
 */
export const wadSchema = valSchema.transform((val) => {
  return {
    /** @type Wad */
    value: val,
    formatted: formatValue(val, 'wad'),
  };
});
export type Wad = z.infer<typeof wadSchema>;

/**
 * Schema for Ray values (27 decimal fixed-point numbers)
 */
export const raySchema = valSchema.transform((val) => {
  return {
    /** @type Ray */
    value: val,
    formatted: formatValue(val, 'ray'),
  };
});
export type Ray = z.infer<typeof raySchema>;

// Custom types

/**
 * Schema for asset balance input with symbol and amount
 */
export const assetBalanceInputSchema = z.object({
  symbol: z.string().describe('Symbol of asset'),
  amount: z.string().describe('Amount of asset'),
});
export const assetBalancesInputSchema = z.array(assetBalanceInputSchema);

export type AssetBalanceInput = z.infer<typeof assetBalanceInputSchema>;
export type AssetBalancesInput = z.infer<typeof assetBalancesInputSchema>;

/**
 * Schema for asset balance with address and amount
 */
export const assetBalanceSchema = z.object({
  address: z.string().describe('Address of asset'),
  amount: z.bigint().describe('Amount of asset'),
});
export const assetBalancesSchema = z.array(assetBalanceSchema);

export type AssetBalance = z.infer<typeof assetBalanceSchema>;
export type AssetBalances = z.infer<typeof assetBalancesSchema>;

/**
 * Schema for trove health metrics including debt, value, LTV and threshold
 */
export const healthSchema = z.object({
  debt: wadSchema.describe('Debt of trove'),
  value: wadSchema.describe('Value of trove'),
  ltv: raySchema.describe('LTV of trove'),
  threshold: raySchema.describe('Threshold of trove'),
});
export type Health = z.infer<typeof healthSchema>;

// Transaction schemas

/**
 * Schema for getting user troves
 */
export const getUserTrovesSchema = z.object({
  user: z.string().describe('Address of user'),
});
export type GetUserTrovesParams = z.infer<typeof getUserTrovesSchema>;

/**
 * Schema for getting trove health
 */
export const getTroveHealthSchema = z.object({
  troveId: z.number().describe('Trove ID'),
});
export type GetTroveHealthParams = z.infer<typeof getTroveHealthSchema>;

/**
 * Schema for opening a new trove
 */
export const openTroveSchema = z.object({
  collaterals: assetBalancesInputSchema.describe(
    'Collateral assets to deposit'
  ),
  borrowAmount: z.string().describe('Amount of CASH to borrow'),
  maxBorrowFeePct: z
    .string()
    .regex(/.*%$/, 'Must end with %')
    .describe('Maximum borrow fee as a % of borrow amount'),
});

export type OpenTroveParams = z.infer<typeof openTroveSchema>;

/**
 * Schema for collateral-related actions (deposit/withdraw)
 */
export const collateralActionSchema = z.object({
  troveId: z.number().describe('Trove ID'),
  collateral: assetBalanceInputSchema.describe('Collateral to deposit'),
});

export type DepositTroveParams = z.infer<typeof collateralActionSchema>;
export type WithdrawTroveParams = z.infer<typeof collateralActionSchema>;

/**
 * Schema for borrowing from a trove
 */
export const borrowTroveSchema = z.object({
  troveId: z.number().describe('Trove ID'),
  amount: z.string().describe('Amount of CASH to repay'),
  maxBorrowFeePct: z
    .string()
    .describe('Maximum borrow fee as a % of borrow amount'),
});

export type BorrowTroveParams = z.infer<typeof borrowTroveSchema>;

/**
 * Schema for repaying trove debt
 */
export const repayTroveSchema = z.object({
  troveId: z.number().describe('Trove ID'),
  amount: z.string().describe('Amount to repay'),
});

export type RepayTroveParams = z.infer<typeof repayTroveSchema>;

// Event schemas

/**
 * Schema for TroveOpened event data
 */
export const troveOpenedEventSchema = z.object({
  user: z.bigint(),
  trove_id: z.bigint(),
});

/**
 * Schema for ForgeFeePaid event data
 */
export const forgeFeePaidEventSchema = z.object({
  trove_id: z.bigint(),
  fee: wadSchema,
  fee_pct: wadSchema,
});
