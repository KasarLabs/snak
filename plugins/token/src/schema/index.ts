import { z } from 'zod';

export const Transferschema = z.object({
  recipient_address: z.string().describe('The recipient public address'),
  amount: z.string().describe('The amount of erc20 token that will be send'),
  symbol: z.string().describe('The symbol of the erc20 token'),
});

export const getOwnBalanceSchema = z.object({
  symbol: z
    .string()
    .describe('The asset symbol to get the balance of. eg. USDC, ETH'),
});

export const getBalanceSchema = z.object({
  walletAddress: z
    .string()
    .describe('The wallet address to get the balance of'),
  assetSymbol: z
    .string()
    .describe('The asset symbol to get the balance of. eg. USDC, ETH'),
});

export const transferSignatureschema = z.object({
  payloads: z
    .array(Transferschema)
    .describe('Array of payloads for a tranfer transaction'),
});
