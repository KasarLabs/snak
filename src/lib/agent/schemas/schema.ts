import { z } from 'zod';

// Schema definitions

export const DeployArgentAccountSchema = z.object({
  publicKeyAX: z
    .string()
    .describe('The public key to deploy the Argent Account'),
  privateKeyAX: z
    .string()
    .describe('The private key to deploy the Argent Account'),
  precalculate_address: z
    .string()
    .describe('The precalculate hash to deploy Argent account'),
});

export const DeployOZAccountSchema = z.object({
  publicKey: z.string().describe('The public key to deploy the OZ Account'),
  privateKey: z.string().describe('The private key to deploy the OZ Account'),
  precalculate_address: z
    .string()
    .describe('The precalculate hash to deploy OZ account'),
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

// Avnu

//RPC

// RPC

// In schema.ts

//Vesu integration

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

// For sign message
export const signMessageSchema = z.object({
  typedData: z
    .object({
      types: z.record(
        z.string(),
        z.array(
          z.object({
            name: z.string(),
            type: z.string(),
          })
        )
      ),
      primaryType: z.string(),
      domain: z.record(z.string(), z.union([z.string(), z.number()])),
      message: z.record(z.string(), z.any()),
    })
    .describe('The typed data object conforming to EIP-712'),
});

// For verify message
export const verifyMessageSchema = z.object({
  typedData: z
    .object({
      types: z.record(
        z.string(),
        z.array(
          z.object({
            name: z.string(),
            type: z.string(),
          })
        )
      ),
      primaryType: z.string(),
      domain: z.record(z.string(), z.union([z.string(), z.number()])),
      message: z.record(z.string(), z.any()),
    })
    .describe('The typed data that was signed'),
  signature: z
    .array(z.string())
    .length(2)
    .describe('The signature as array of r and s values'),
  publicKey: z.string().describe('The public key to verify against'),
});

// Twitter

// CoinGecko

const CoinGeckoCheckTokenPayload = z.object({
  name: z.string().describe('the name of the token'),
});
export const CoinGeckoCheckTokenPriceSchema = z.object({
  tokens: z.array(CoinGeckoCheckTokenPayload).describe('Array of tokens name'),
});
export type TransactionHashParams = z.infer<typeof transactionHashSchema>;

// Types for function parameters that match the schemas

export type CoinGeckoCheckTokenPriceParams = z.infer<
  typeof CoinGeckoCheckTokenPriceSchema
>;
