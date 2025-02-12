import { z } from 'zod';

export const Transferschema = z.object({
  recipient_address: z.string().describe('The recipient public address'),
  amount: z.string().describe('The amount'),
  symbol: z.string().describe('The symbol of the erc20 token'),
});

export const transferSignatureschema = z.object({
  payloads: z
    .array(Transferschema)
    .describe('Array of payloads for a tranfer transaction'),
});

export const DeployArgentAccountSignatureSchema = z.object({
  publicKeyAX: z
    .string()
    .describe('The public key to deploy the Argent Account'),
  privateKeyAX: z
    .string()
    .describe('The private key to deploy the Argent Account'),
});

export const getBalanceSignatureSchema = z.object({
  accountAddress: z.string().describe('the account address'),
  assetSymbol: z.string().describe('token Symbol'),
});

/* Schema for artpeace implementation */
export const placePixelParamSchema = z.object({
  canvasId: z
    .union([z.number(), z.string()])
    .describe('The id or the unique name of the world to dispose the pixel'),
  xPos: z.number().describe('The position on x axe of the pixel'),
  yPos: z.number().describe('The position on y axe of the pixel'),
  color: z.string().describe('The color of the pixel'),
});

export const placePixelSignatureSchema = z.object({
  params: z
    .array(placePixelParamSchema)
    .describe('Array of parameter to place one or multiple pixel'),
});
