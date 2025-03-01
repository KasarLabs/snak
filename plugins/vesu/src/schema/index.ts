import { z } from 'zod';

export const depositEarnSchema = z.object({
  depositTokenSymbol: z
    .string()
    .describe("Symbol of the token to deposit (e.g., 'ETH', 'USDC')"),
  depositAmount: z.string().describe('Amount of tokens to deposit'),
});

export const withdrawEarnSchema = z.object({
  withdrawTokenSymbol: z
    .string()
    .describe("Symbol of the token to withdraw (e.g., 'ETH', 'USDC')"),
});
