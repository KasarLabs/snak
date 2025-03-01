import z from 'zod';

export const swapSchema = z.object({
  sellTokenSymbol: z
    .string()
    .describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
  buyTokenSymbol: z
    .string()
    .describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
  sellAmount: z.number().positive().describe('Amount of tokens to sell'),
});

export const routeSchema = z.object({
  sellTokenSymbol: z
    .string()
    .describe("Symbol of the token to sell (e.g., 'ETH', 'USDC')"),
  buyTokenSymbol: z
    .string()
    .describe("Symbol of the token to buy (e.g., 'ETH', 'USDC')"),
  sellAmount: z.number().positive().describe('Amount of tokens to sell'),
});
